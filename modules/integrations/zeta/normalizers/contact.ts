import type { PartyIdentifierType, PartyRoleType } from "@/modules/directory/types";
import {
  asRecord,
  firstString,
  normalizeCounterpartyTaxId,
  parseZetaDate,
  type JsonRecord,
} from "@/modules/integrations/zeta/normalizers/common";

export type ZetaContactCandidate = {
  provider: "zetasoftware";
  sourceKind: "zeta_contact";
  externalKey: string;
  displayName: string;
  legalName: string | null;
  taxId: string | null;
  taxIdNormalized: string | null;
  taxIdentifierType: Extract<PartyIdentifierType, "rut" | "tax_id"> | null;
  roles: Extract<PartyRoleType, "customer" | "vendor">[];
  status: "active" | "inactive";
  countryCode: string | null;
  department: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  emails: string[];
  registeredAt: string | null;
  raw: JsonRecord;
};

function compactText(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function zetaBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!normalized) {
    return fallback;
  }

  if (["s", "si", "true", "1", "y", "yes", "activo", "activa"].includes(normalized)) {
    return true;
  }

  if (["n", "no", "false", "0", "inactivo", "inactiva", "baja"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeEmail(value: unknown) {
  const email = firstString(value)?.toLowerCase();

  if (!email || !email.includes("@")) {
    return null;
  }

  return email;
}

function normalizeCountryCode(rawCode: string | null, rawName: string | null) {
  const code = rawCode?.trim().toUpperCase() ?? "";
  const name = rawName
    ?.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") ?? "";

  if (!code && !name) {
    return null;
  }

  if (["UY", "URY", "858"].includes(code) || name.includes("uruguay")) {
    return "UY";
  }

  return code || null;
}

export function buildZetaContactExternalKey(raw: JsonRecord) {
  return firstString(raw.Codigo, raw.ContactoCodigo, raw.CodigoContacto, raw.Id, raw.RUT, raw.Documento)
    ?? `contact:${JSON.stringify(raw).slice(0, 120)}`;
}

export function normalizeZetaContact(value: unknown): ZetaContactCandidate {
  const raw = asRecord(value);
  const externalKey = buildZetaContactExternalKey(raw);
  const displayName = compactText(firstString(raw.Nombre, raw.RazonSocial, raw.NombreFantasia))
    ?? externalKey;
  const legalName = compactText(firstString(raw.RazonSocial, raw.Nombre));
  const rut = compactText(firstString(raw.RUT, raw.Ruc));
  const document = compactText(firstString(raw.Documento));
  const taxId = rut ?? document;
  const taxIdNormalized = normalizeCounterpartyTaxId(taxId);
  const roles: ZetaContactCandidate["roles"] = [];

  if (zetaBoolean(raw.EsCliente)) {
    roles.push("customer");
  }

  if (zetaBoolean(raw.EsProveedor)) {
    roles.push("vendor");
  }

  const emails = Array.from(
    new Set([
      normalizeEmail(raw.Email1),
      normalizeEmail(raw.Email2),
      normalizeEmail(raw.Email),
    ].filter((email): email is string => Boolean(email))),
  );

  return {
    provider: "zetasoftware",
    sourceKind: "zeta_contact",
    externalKey,
    displayName,
    legalName,
    taxId,
    taxIdNormalized,
    taxIdentifierType: taxId ? (rut ? "rut" : "tax_id") : null,
    roles,
    status: zetaBoolean(raw.ContactoActivo, true) ? "active" : "inactive",
    countryCode: normalizeCountryCode(
      compactText(firstString(raw.PaisCodigo)),
      compactText(firstString(raw.PaisNombre)),
    ),
    department: compactText(firstString(raw.DepartamentoNombre, raw.DepartamentoCodigo)),
    city: compactText(firstString(raw.Localidad, raw.Ciudad)),
    address: compactText(firstString(raw.DireccionCompleta, raw.Direccion)),
    postalCode: compactText(firstString(raw.CodigoPostal)),
    emails,
    registeredAt: parseZetaDate(raw.FechaRegistro),
    raw,
  };
}
