import type { DocumentIntakeOutput } from "@/modules/ai/document-intake-contract";

export type DocumentProcessingProvider = "openai" | "codex_local";

/** A persisted document choice survives changes to the server default. Never fall back. */
export function resolveDocumentProcessingProvider(metadata?: Record<string, unknown> | null): DocumentProcessingProvider {
  // Deployment inputs may carry CRLF; persisted document choices remain strict.
  const value = metadata?.processing_provider ?? process.env.CONVERTILABS_PROCESSING_PROVIDER?.trim() ?? "openai";
  if (value !== "openai" && value !== "codex_local") {
    throw new Error("Proveedor documental invalido. Usa codex_local u openai explicitamente.");
  }
  return value;
}

export function collectLocalDocumentValidationWarnings(output: DocumentIntakeOutput): string[] {
  const warnings = [...output.warnings];
  const facts = output.facts;
  for (const [field, label] of Object.entries({
    issuer_name: "proveedor/emisor", issuer_tax_id: "RUT del emisor", document_number: "numero del comprobante",
    document_date: "fecha", currency_code: "moneda", total_amount: "total",
  })) {
    const value = facts[field as keyof typeof facts];
    if (value === null || value === "") warnings.push(`Falta ${label}; completar comparando con el original.`);
  }
  for (const field of ["document_date", "due_date"] as const) {
    const value = facts[field];
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
      || new Date(value).toISOString().slice(0, 10) !== value)) {
      warnings.push(`La fecha ${field} no es valida; requiere revision.`);
    }
  }
  if (facts.currency_code && !/^[A-Z]{3}$/.test(facts.currency_code)) warnings.push("Codigo de moneda ambiguo; requiere revision.");
  const mismatch = (left: number | null, right: number | null) => left !== null && right !== null && Math.abs(left - right) > 0.02;
  if (facts.subtotal !== null && facts.tax_amount !== null && mismatch(facts.subtotal + facts.tax_amount, facts.total_amount)) {
    warnings.push("Subtotal + impuestos no coincide con el total; requiere revision.");
  }
  for (const [index, line] of output.line_items.entries()) {
    if (line.quantity !== null && line.unit_amount !== null && mismatch(line.quantity * line.unit_amount, line.net_amount)) {
      warnings.push(`Linea ${index + 1}: cantidad por precio no coincide con el neto; revisar descuentos o redondeos.`);
    }
    if (line.net_amount !== null && line.tax_amount !== null && mismatch(line.net_amount + line.tax_amount, line.total_amount)) {
      warnings.push(`Linea ${index + 1}: neto + impuesto no coincide con el total.`);
    }
  }
  if (output.line_items.length > 0 && output.line_items.every((line) => line.total_amount !== null)) {
    if (mismatch(output.line_items.reduce((sum, line) => sum + line.total_amount!, 0), facts.total_amount)) {
      warnings.push("La suma de las lineas no coincide con el total del comprobante.");
    }
  }
  warnings.push("Extraccion con Codex local: comparar con el original y confirmar antes de registrar en Zeta.");
  return [...new Set(warnings)];
}
