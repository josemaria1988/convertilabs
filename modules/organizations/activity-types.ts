export type ActivityCatalogEntry = {
  code: string;
  title: string;
  section: string;
  division: string;
  group: string;
  class: string;
  aliases: string[];
  is_active: boolean;
  source: string;
  snapshot_version?: string;
};

export type OrganizationTraitGroup =
  | "business_activity"
  | "tax_and_operations"
  | "operating_model";

export type OrganizationTraitDefinition = {
  code: string;
  group: OrganizationTraitGroup;
  label: string;
  description: string;
  source_kind: "official-inspired" | "system";
  affects_presets: string[];
  affects_tax_profiles: string[];
};

export type BusinessProfileInput = {
  primaryActivityCode: string;
  secondaryActivityCodes: string[];
  selectedTraits: string[];
  shortDescription?: string | null;
};
