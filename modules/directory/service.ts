import type {
  ContactPayload,
  PartyContactPayload,
  PartyCreateInput,
  PartyCreatePayload,
  PartyIdentifierPayload,
  PartyIdentifierType,
  PartyRolePayload,
  PartyRoleType,
} from "@/modules/directory/types";

function compactText(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function normalizeLooseToken(value: string | null | undefined) {
  return compactText(value)?.toLowerCase() ?? null;
}

export function normalizePartyName(value: string | null | undefined) {
  return normalizeLooseToken(value);
}

export function normalizeTaxIdentifier(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D+/g, "");
  return digits.length > 0 ? digits : null;
}

export function normalizePartyIdentifierValue(
  identifierType: PartyIdentifierType,
  value: string | null | undefined,
) {
  if (identifierType === "rut" || identifierType === "tax_id" || identifierType === "phone") {
    return normalizeTaxIdentifier(value);
  }

  if (identifierType === "email") {
    return compactText(value)?.toLowerCase() ?? null;
  }

  return normalizeLooseToken(value);
}

function requiredText(value: string | null | undefined, label: string) {
  const normalized = compactText(value);

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

export function canManageDirectory(role: string) {
  return ["owner", "admin", "admin_processing", "accountant", "reviewer", "operator"].includes(role);
}

export function buildPartyCreatePayload(input: PartyCreateInput): PartyCreatePayload {
  const displayName = requiredText(input.displayName, "Party display name");
  const legalName = compactText(input.legalName) ?? displayName;
  const normalizedName = normalizePartyName(displayName) ?? displayName.toLowerCase();
  const taxId = compactText(input.taxId);

  return {
    organization_id: input.organizationId,
    display_name: displayName,
    legal_name: legalName,
    normalized_name: normalizedName,
    tax_id: taxId,
    tax_id_normalized: normalizeTaxIdentifier(taxId),
    country_code: compactText(input.countryCode)?.toUpperCase() ?? "UY",
    default_currency_code: compactText(input.defaultCurrencyCode)?.toUpperCase() ?? null,
    source: compactText(input.source) ?? "manual",
    metadata_json: input.metadata ?? {},
    created_by: input.actorId ?? null,
    updated_by: input.actorId ?? null,
  };
}

export function buildPartyRolePayload(input: {
  organizationId: string;
  partyId: string;
  roleType: PartyRoleType;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}): PartyRolePayload {
  return {
    organization_id: input.organizationId,
    party_id: input.partyId,
    role_type: input.roleType,
    status: "active",
    metadata_json: input.metadata ?? {},
    created_by: input.actorId ?? null,
  };
}

export function buildPartyIdentifierPayload(input: {
  organizationId: string;
  partyId: string;
  identifierType: PartyIdentifierType;
  identifierValue: string;
  countryCode?: string | null;
  isPrimary?: boolean;
  source?: string | null;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}): PartyIdentifierPayload {
  const identifierValue = requiredText(input.identifierValue, "Party identifier value");
  const normalized = normalizePartyIdentifierValue(input.identifierType, identifierValue);

  if (!normalized) {
    throw new Error("Party identifier value cannot be normalized.");
  }

  return {
    organization_id: input.organizationId,
    party_id: input.partyId,
    identifier_type: input.identifierType,
    identifier_value: identifierValue,
    identifier_value_normalized: normalized,
    country_code: compactText(input.countryCode)?.toUpperCase() ?? null,
    is_primary: input.isPrimary ?? false,
    source: compactText(input.source) ?? "manual",
    metadata_json: input.metadata ?? {},
    created_by: input.actorId ?? null,
  };
}

export function buildContactPayload(input: {
  organizationId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}): ContactPayload {
  const fullName = requiredText(input.fullName, "Contact full name");

  return {
    organization_id: input.organizationId,
    full_name: fullName,
    normalized_name: normalizePartyName(fullName) ?? fullName.toLowerCase(),
    email: compactText(input.email),
    email_normalized: compactText(input.email)?.toLowerCase() ?? null,
    phone: compactText(input.phone),
    mobile: compactText(input.mobile),
    notes: compactText(input.notes),
    status: "active",
    metadata_json: input.metadata ?? {},
    created_by: input.actorId ?? null,
    updated_by: input.actorId ?? null,
  };
}

export function buildPartyContactPayload(input: {
  organizationId: string;
  partyId: string;
  contactId: string;
  relationshipLabel?: string | null;
  isPrimary?: boolean;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}): PartyContactPayload {
  return {
    organization_id: input.organizationId,
    party_id: input.partyId,
    contact_id: input.contactId,
    relationship_label: compactText(input.relationshipLabel),
    is_primary: input.isPrimary ?? false,
    metadata_json: input.metadata ?? {},
    created_by: input.actorId ?? null,
  };
}

export function resolvePartyDisplayLabel(input: {
  displayName?: string | null;
  legalName?: string | null;
  taxId?: string | null;
}) {
  return compactText(input.displayName)
    ?? compactText(input.legalName)
    ?? compactText(input.taxId)
    ?? "Party sin nombre";
}
