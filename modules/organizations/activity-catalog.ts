import activityCatalogData from "@/data/uy/ciiu-rev4-activity-catalog.json";
import activityAliasData from "@/data/uy/ciiu-rev4-activity-search-aliases.json";
import type {
  ActivityBreadcrumbItem,
  ActivityCatalogEntry,
  ActivityCatalogRawEntry,
  ActivitySearchOptions,
} from "@/modules/organizations/activity-types";

type ActivityAliasEntry = {
  code: string;
  aliases: string[];
};

function compareCodes(left: string, right: string) {
  return left.localeCompare(right, "es", {
    sensitivity: "base",
    numeric: true,
  });
}

function normalizeActivityCode(code: string | null | undefined) {
  return (code ?? "").trim().toUpperCase();
}

const rawEntries = (activityCatalogData as ActivityCatalogRawEntry[])
  .filter((entry) => entry.is_active)
  .sort((left, right) => compareCodes(left.code, right.code));
const rawEntryByCode = new Map(rawEntries.map((entry) => [entry.code, entry]));
const aliasByCode = new Map(
  (activityAliasData as ActivityAliasEntry[])
    .filter((entry) => typeof entry.code === "string" && Array.isArray(entry.aliases))
    .map((entry) => [entry.code, entry.aliases]),
);

function getRawAncestors(rawEntry: ActivityCatalogRawEntry) {
  const ancestors: ActivityCatalogRawEntry[] = [];
  let parentCode = rawEntry.parent_code;

  while (parentCode) {
    const parent = rawEntryByCode.get(parentCode);

    if (!parent) {
      break;
    }

    ancestors.unshift(parent);
    parentCode = parent.parent_code;
  }

  return ancestors;
}

function toBreadcrumbItem(rawEntry: ActivityCatalogRawEntry): ActivityBreadcrumbItem {
  return {
    code: rawEntry.code,
    displayCode: rawEntry.display_code,
    title: rawEntry.description,
    level: rawEntry.level,
  };
}

function buildActivityEntry(rawEntry: ActivityCatalogRawEntry): ActivityCatalogEntry {
  const ancestors = getRawAncestors(rawEntry);
  const breadcrumb = [...ancestors, rawEntry].map((entry) => toBreadcrumbItem(entry));
  const section = ancestors.find((entry) => entry.level === "section")
    ?? (rawEntry.level === "section" ? rawEntry : null);

  return {
    code: rawEntry.code,
    displayCode: rawEntry.display_code,
    title: rawEntry.description,
    description: rawEntry.description,
    level: rawEntry.level,
    parentCode: rawEntry.parent_code,
    isLeaf: rawEntry.is_leaf,
    isSelectable: rawEntry.is_leaf || rawEntry.is_special_annex,
    requiresRefinement: !rawEntry.is_leaf && !rawEntry.is_special_annex,
    isSpecialAnnex: rawEntry.is_special_annex,
    isLegacySelection: false,
    legacyResolvedCode: null,
    isActive: rawEntry.is_active,
    sectionCode: rawEntry.section_code,
    divisionCode: rawEntry.division_code,
    groupCode: rawEntry.group_code,
    classCode: rawEntry.class_code,
    sectionLabel: section?.description ?? null,
    breadcrumb,
    breadcrumbLabel: breadcrumb.map((item) => item.title).join(" / "),
    aliases: aliasByCode.get(rawEntry.code) ?? [],
    sourceVersion: rawEntry.source_version,
  };
}

const activityCatalog = rawEntries.map((entry) => buildActivityEntry(entry));
const activityByCode = new Map(activityCatalog.map((entry) => [entry.code, entry]));
const childrenByParentCode = new Map<string, ActivityCatalogEntry[]>();

for (const entry of activityCatalog) {
  if (!entry.parentCode) {
    continue;
  }

  const current = childrenByParentCode.get(entry.parentCode) ?? [];
  current.push(entry);
  current.sort((left, right) => compareCodes(left.code, right.code));
  childrenByParentCode.set(entry.parentCode, current);
}

function buildLegacyDisplayCode(code: string) {
  if (/^\d{5}$/.test(code)) {
    return `${code.slice(0, 4)}.${code.slice(4)}`;
  }

  return code;
}

export function resolveLegacyActivityCode(code: string | null | undefined) {
  const normalizedCode = normalizeActivityCode(code);

  if (!normalizedCode || activityByCode.has(normalizedCode)) {
    return null;
  }

  if (/^\d{5}$/.test(normalizedCode) && normalizedCode.endsWith("0")) {
    const coarseParentCode = normalizedCode.slice(0, -1);
    const parentEntry = activityByCode.get(coarseParentCode);

    if (parentEntry && parentEntry.requiresRefinement) {
      return {
        ...parentEntry,
        code: normalizedCode,
        displayCode: buildLegacyDisplayCode(normalizedCode),
        isLeaf: false,
        isSelectable: false,
        requiresRefinement: true,
        isLegacySelection: true,
        legacyResolvedCode: parentEntry.code,
      } satisfies ActivityCatalogEntry;
    }
  }

  return null;
}

export function listActivityCatalogEntries() {
  return activityCatalog;
}

export function listActivitySearchEntries(options?: ActivitySearchOptions) {
  const includeSpecialAnnex = options?.includeSpecialAnnex ?? false;
  const selectableOnly = options?.selectableOnly ?? false;

  return activityCatalog.filter((entry) => {
    if (entry.level === "section") {
      return false;
    }

    if (!includeSpecialAnnex && entry.isSpecialAnnex) {
      return false;
    }

    if (selectableOnly && !entry.isSelectable) {
      return false;
    }

    return true;
  });
}

export function getActivityByCode(code: string | null | undefined) {
  const normalizedCode = normalizeActivityCode(code);

  if (!normalizedCode) {
    return null;
  }

  return activityByCode.get(normalizedCode)
    ?? resolveLegacyActivityCode(normalizedCode);
}

export function getActivityChildren(
  parentCode: string | null | undefined,
  options?: ActivitySearchOptions,
) {
  const parent = getActivityByCode(parentCode);
  const normalizedParentCode = parent?.legacyResolvedCode ?? parent?.code ?? normalizeActivityCode(parentCode);
  const includeSpecialAnnex = options?.includeSpecialAnnex ?? false;
  const selectableOnly = options?.selectableOnly ?? false;
  const limit = options?.limit ?? Number.POSITIVE_INFINITY;

  return (childrenByParentCode.get(normalizedParentCode) ?? [])
    .filter((entry) => {
      if (!includeSpecialAnnex && entry.isSpecialAnnex) {
        return false;
      }

      if (selectableOnly && !entry.isSelectable) {
        return false;
      }

      return true;
    })
    .slice(0, limit);
}

export function getActivityAncestors(code: string | null | undefined) {
  const entry = getActivityByCode(code);

  if (!entry) {
    return [];
  }

  const ancestorChain = entry.breadcrumb.slice(0, -1);

  return ancestorChain
    .map((ancestor) => activityByCode.get(ancestor.code))
    .filter((ancestor): ancestor is ActivityCatalogEntry => Boolean(ancestor));
}

export function getActivityHierarchyCodes(code: string | null | undefined) {
  const entry = getActivityByCode(code);

  if (!entry) {
    return [];
  }

  return entry.breadcrumb.map((ancestor) => ancestor.code);
}

export function isActivityCodeSelectable(code: string | null | undefined) {
  return getActivityByCode(code)?.isSelectable ?? false;
}

export function requiresActivityRefinement(code: string | null | undefined) {
  return getActivityByCode(code)?.requiresRefinement ?? false;
}

export function getActivityCatalogVersion() {
  return activityCatalog[0]?.sourceVersion ?? "unknown";
}

export { normalizeActivityCode };
