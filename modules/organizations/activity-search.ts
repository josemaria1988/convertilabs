import type { ActivityCatalogEntry } from "@/modules/organizations/activity-types";
import { listActivityCatalogEntries } from "@/modules/organizations/activity-catalog";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function scoreEntry(entry: ActivityCatalogEntry, query: string) {
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);
  const title = normalizeText(entry.title);
  const aliases = entry.aliases.map((alias) => normalizeText(alias));
  let score = 0;

  if (entry.code === query.trim()) {
    score += 300;
  }

  if (title.startsWith(normalizedQuery)) {
    score += 160;
  }

  if (title.includes(normalizedQuery)) {
    score += 110;
  }

  for (const alias of aliases) {
    if (alias === normalizedQuery) {
      score += 140;
    } else if (alias.includes(normalizedQuery)) {
      score += 90;
    }
  }

  for (const token of queryTokens) {
    if (title.includes(token)) {
      score += 28;
    }

    if (aliases.some((alias) => alias.includes(token))) {
      score += 18;
    }
  }

  return score;
}

export function searchActivities(query: string, limit = 8) {
  if (!query.trim()) {
    return listActivityCatalogEntries().slice(0, limit);
  }

  return listActivityCatalogEntries()
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, query),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.entry.code.localeCompare(right.entry.code, "es", {
        sensitivity: "base",
        numeric: true,
      });
    })
    .slice(0, limit)
    .map((item) => item.entry);
}

export function getSuggestedActivitiesFromText(text: string, limit = 3) {
  if (!text.trim()) {
    return [];
  }

  return searchActivities(text, limit);
}
