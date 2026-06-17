export const PARTY_ROLE_TYPES = [
  "customer",
  "vendor",
  "bank",
  "institution",
  "accountant",
  "employee",
  "partner",
  "transport",
  "internal",
  "other",
] as const;

export type PartyRoleType = (typeof PARTY_ROLE_TYPES)[number];

export const PARTY_IDENTIFIER_TYPES = [
  "rut",
  "tax_id",
  "email",
  "phone",
  "zeta_contact_code",
  "zeta_customer_code",
  "zeta_supplier_code",
  "external_code",
  "other",
] as const;

export type PartyIdentifierType = (typeof PARTY_IDENTIFIER_TYPES)[number];

export type PartyCreateInput = {
  organizationId: string;
  displayName: string;
  legalName?: string | null;
  taxId?: string | null;
  countryCode?: string | null;
  defaultCurrencyCode?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
};

export type PartyCreatePayload = {
  organization_id: string;
  display_name: string;
  legal_name: string | null;
  normalized_name: string;
  tax_id: string | null;
  tax_id_normalized: string | null;
  country_code: string;
  default_currency_code: string | null;
  source: string;
  metadata_json: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
};

export type PartyRolePayload = {
  organization_id: string;
  party_id: string;
  role_type: PartyRoleType;
  status: "active";
  metadata_json: Record<string, unknown>;
  created_by: string | null;
};

export type PartyIdentifierPayload = {
  organization_id: string;
  party_id: string;
  identifier_type: PartyIdentifierType;
  identifier_value: string;
  identifier_value_normalized: string;
  country_code: string | null;
  is_primary: boolean;
  source: string;
  metadata_json: Record<string, unknown>;
  created_by: string | null;
};

export type ContactPayload = {
  organization_id: string;
  full_name: string;
  normalized_name: string;
  email: string | null;
  email_normalized: string | null;
  phone: string | null;
  mobile: string | null;
  notes: string | null;
  status: "active";
  metadata_json: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
};

export type PartyContactPayload = {
  organization_id: string;
  party_id: string;
  contact_id: string;
  relationship_label: string | null;
  is_primary: boolean;
  metadata_json: Record<string, unknown>;
  created_by: string | null;
};
