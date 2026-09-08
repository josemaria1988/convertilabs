import { CodexProviderError } from "./codex-process";

type Schema = boolean | Record<string, unknown>;

/** Validates the JSON-Schema subset used by the document contract, without coercion. */
export function validateCodexOutput(output: unknown, root: Record<string, unknown>) {
  let nodes = 0;
  const matches = (value: unknown, schema: Schema, depth = 0): boolean => {
    if (++nodes > 100_000 || depth > 64) return false;
    if (typeof schema === "boolean") return schema;
    if (schema.$ref !== undefined) {
      throw new CodexProviderError("unsupported_schema", "El esquema local debe estar expandido, sin referencias $ref.");
    }
    if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) return false;
    if (Array.isArray(schema.enum) && !schema.enum.some((entry) => JSON.stringify(entry) === JSON.stringify(value))) return false;
    if (Array.isArray(schema.anyOf) && !schema.anyOf.some((entry) => matches(value, entry, depth + 1))) return false;
    if (Array.isArray(schema.oneOf) && schema.oneOf.filter((entry) => matches(value, entry, depth + 1)).length !== 1) return false;
    if (Array.isArray(schema.allOf) && !schema.allOf.every((entry) => matches(value, entry, depth + 1))) return false;
    if (schema.not && matches(value, schema.not as Schema, depth + 1)) return false;
    const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
    const typeMatches = (type: unknown) => {
      if (type === "null") return value === null;
      if (type === "array") return Array.isArray(value);
      if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
      if (type === "integer") return typeof value === "number" && Number.isSafeInteger(value);
      if (type === "number") return typeof value === "number" && Number.isFinite(value);
      return ["string", "boolean"].includes(String(type)) && typeof value === type;
    };
    if (types.length && !types.some(typeMatches)) return false;
    if (typeof value === "number") {
      if (typeof schema.minimum === "number" && value < schema.minimum) return false;
      if (typeof schema.maximum === "number" && value > schema.maximum) return false;
      if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) return false;
      if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) return false;
    }
    if (typeof value === "string") {
      if (typeof schema.minLength === "number" && [...value].length < schema.minLength) return false;
      if (typeof schema.maxLength === "number" && [...value].length > schema.maxLength) return false;
      if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) return false;
    }
    if (Array.isArray(value)) {
      if (typeof schema.minItems === "number" && value.length < schema.minItems) return false;
      if (typeof schema.maxItems === "number" && value.length > schema.maxItems) return false;
      if (schema.uniqueItems === true && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) return false;
      if (schema.items !== undefined && !value.every((entry) => matches(entry, schema.items as Schema, depth + 1))) return false;
    } else if (value && typeof value === "object") {
      const object = value as Record<string, unknown>;
      const properties = (schema.properties ?? {}) as Record<string, Schema>;
      if (Array.isArray(schema.required) && schema.required.some((key) => !Object.hasOwn(object, String(key)))) return false;
      for (const [key, entry] of Object.entries(object)) {
        if (Object.hasOwn(properties, key)) {
          if (!matches(entry, properties[key], depth + 1)) return false;
        } else if (schema.additionalProperties === false) return false;
        else if (schema.additionalProperties && typeof schema.additionalProperties === "object"
          && !matches(entry, schema.additionalProperties as Schema, depth + 1)) return false;
      }
    }
    return true;
  };
  if (!matches(output, root)) {
    throw new CodexProviderError("invalid_output", "Codex devolvió datos que no cumplen el formato esperado. Podés volver a procesar el documento.", true);
  }
}
