import type { InteractionItem } from "@/modules/communications";

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

export type DirectoryPartyListItem = {
  id: string;
  displayName: string;
  legalName: string | null;
  taxId: string | null;
  status: string | null;
  source: string | null;
  updatedAt: string | null;
  roles: PartyRoleType[];
  contactCount: number;
  interactionCount: number;
};

export type DirectoryDashboardData = {
  isAvailable: boolean;
  parties: DirectoryPartyListItem[];
  summary: {
    totalParties: number;
    customers: number;
    vendors: number;
    contacts: number;
    interactions: number;
  };
};

export type DirectoryIdentifierItem = {
  id: string;
  identifierType: PartyIdentifierType;
  identifierValue: string;
  isPrimary: boolean;
};

export type DirectoryContactItem = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  relationshipLabel: string | null;
  isPrimary: boolean;
  notes: string | null;
};

export type DirectoryWorkUnitItem = {
  id: string;
  name: string;
  status: string | null;
  kind: string | null;
};

export type DirectoryDocumentItem = {
  id: string;
  label: string;
  documentDate: string | null;
  lifecycleStatus: string | null;
};

export type DirectoryMoneyItem = {
  id: string;
  documentRole: string | null;
  dueDate: string | null;
  outstandingAmount: number;
  status: string | null;
};

export type DirectoryTaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
};

export type PartyProfileData = {
  isAvailable: boolean;
  party: DirectoryPartyListItem | null;
  identifiers: DirectoryIdentifierItem[];
  contacts: DirectoryContactItem[];
  workUnits: DirectoryWorkUnitItem[];
  documents: DirectoryDocumentItem[];
  moneyItems: DirectoryMoneyItem[];
  tasks: DirectoryTaskItem[];
  interactionsAvailable: boolean;
  interactions: InteractionItem[];
};
