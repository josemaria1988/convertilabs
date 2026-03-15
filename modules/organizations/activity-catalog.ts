import activityCatalogData from "@/data/uy/ciiu-rev4-activity-catalog.json";
import type { ActivityCatalogEntry } from "@/modules/organizations/activity-types";

const activityCatalog = (activityCatalogData as ActivityCatalogEntry[])
  .filter((entry) => entry.is_active)
  .sort((left, right) => left.code.localeCompare(right.code, "es", {
    sensitivity: "base",
    numeric: true,
  }));

const activityByCode = new Map(activityCatalog.map((entry) => [entry.code, entry]));

export function listActivityCatalogEntries() {
  return activityCatalog;
}

export function getActivityByCode(code: string | null | undefined) {
  if (!code) {
    return null;
  }

  return activityByCode.get(code.trim()) ?? null;
}
