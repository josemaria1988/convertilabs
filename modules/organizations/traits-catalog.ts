import traitsCatalogData from "@/data/uy/organization-traits.json";
import type { OrganizationTraitDefinition, OrganizationTraitGroup } from "@/modules/organizations/activity-types";

const traitsCatalog = traitsCatalogData as OrganizationTraitDefinition[];
const traitByCode = new Map(traitsCatalog.map((trait) => [trait.code, trait]));

export function listOrganizationTraits() {
  return traitsCatalog;
}

export function getOrganizationTraitByCode(code: string | null | undefined) {
  if (!code) {
    return null;
  }

  return traitByCode.get(code.trim()) ?? null;
}

export function listOrganizationTraitsByGroup() {
  const groups: Record<OrganizationTraitGroup, OrganizationTraitDefinition[]> = {
    business_activity: [],
    tax_and_operations: [],
    operating_model: [],
  };

  for (const trait of traitsCatalog) {
    groups[trait.group].push(trait);
  }

  return groups;
}
