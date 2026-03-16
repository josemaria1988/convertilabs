export type ActivityCatalogLevel =
  | "section"
  | "division"
  | "group"
  | "class"
  | "subclass";

export type ActivityCatalogRawEntry = {
  code: string;
  display_code: string;
  description: string;
  level: ActivityCatalogLevel;
  parent_code: string | null;
  is_leaf: boolean;
  section_code: string | null;
  division_code: string | null;
  group_code: string | null;
  class_code: string | null;
  source_version: string;
  is_special_annex: boolean;
  is_active: boolean;
};

export type ActivityBreadcrumbItem = {
  code: string;
  displayCode: string;
  title: string;
  level: ActivityCatalogLevel;
};

export type ActivityCatalogEntry = {
  code: string;
  displayCode: string;
  title: string;
  description: string;
  level: ActivityCatalogLevel;
  parentCode: string | null;
  isLeaf: boolean;
  isSelectable: boolean;
  requiresRefinement: boolean;
  isSpecialAnnex: boolean;
  isLegacySelection: boolean;
  legacyResolvedCode: string | null;
  isActive: boolean;
  sectionCode: string | null;
  divisionCode: string | null;
  groupCode: string | null;
  classCode: string | null;
  sectionLabel: string | null;
  breadcrumb: ActivityBreadcrumbItem[];
  breadcrumbLabel: string;
  aliases: string[];
  sourceVersion: string;
};

export type ActivitySearchOptions = {
  includeSpecialAnnex?: boolean;
  selectableOnly?: boolean;
  limit?: number;
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
