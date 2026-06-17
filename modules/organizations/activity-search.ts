import type {
  ActivityCatalogEntry,
  ActivitySearchOptions,
} from "@/modules/organizations/activity-types";
import { listActivitySearchEntries } from "@/modules/organizations/activity-catalog";

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

const queryStopWords = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "la",
  "las",
  "los",
  "para",
  "por",
  "sin",
  "un",
  "una",
  "y",
  "actividad",
  "actividades",
  "otro",
  "otros",
  "producto",
  "productos",
  "servicio",
  "servicios",
  "varios",
]);

function tokenizeQuery(value: string) {
  return tokenize(value).filter((token) =>
    !queryStopWords.has(token)
    && (token.length > 2 || /\d/.test(token)));
}

function tokenMatches(tokens: string[], token: string) {
  return tokens.some((candidate) =>
    candidate === token
    || (token.length >= 4 && candidate.startsWith(token)));
}

function scoreEntry(entry: ActivityCatalogEntry, query: string) {
  const rawQuery = query.trim();
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenizeQuery(query);
  const title = normalizeText(entry.title);
  const description = normalizeText(entry.description);
  const breadcrumb = normalizeText(entry.breadcrumbLabel);
  const aliases = entry.aliases.map((alias) => normalizeText(alias));
  const displayCode = normalizeText(entry.displayCode);
  const titleTokens = tokenize(entry.title);
  const descriptionTokens = tokenize(entry.description);
  const breadcrumbTokens = tokenize(entry.breadcrumbLabel);
  const aliasTokens = aliases.flatMap((alias) => tokenize(alias));
  let score = 0;

  if (entry.code === rawQuery || entry.displayCode === rawQuery) {
    score += 320;
  }

  if (displayCode.startsWith(normalizedQuery)) {
    score += 220;
  }

  if (title.startsWith(normalizedQuery)) {
    score += 180;
  }

  if (description.includes(normalizedQuery)) {
    score += 110;
  }

  if (breadcrumb.includes(normalizedQuery)) {
    score += 75;
  }

  for (const alias of aliases) {
    if (alias === normalizedQuery) {
      score += 360;
    } else if (alias.includes(normalizedQuery)) {
      score += 145;
    }
  }

  let matchedQueryTokenCount = 0;

  for (const token of queryTokens) {
    const hasTitleOrDescriptionToken =
      tokenMatches(titleTokens, token)
      || tokenMatches(descriptionTokens, token);
    const hasAliasToken = tokenMatches(aliasTokens, token);
    const hasBreadcrumbToken = tokenMatches(breadcrumbTokens, token);

    if (hasTitleOrDescriptionToken) {
      score += 28;
      matchedQueryTokenCount += 1;
    }

    if (hasAliasToken) {
      score += 34;
      if (!hasTitleOrDescriptionToken) {
        matchedQueryTokenCount += 1;
      }
    }

    if (hasBreadcrumbToken) {
      score += 8;
      if (!hasTitleOrDescriptionToken && !hasAliasToken) {
        matchedQueryTokenCount += 1;
      }
    }
  }

  if (queryTokens.length > 1 && matchedQueryTokenCount === queryTokens.length) {
    score += 90;
  }

  if (score === 0) {
    return 0;
  }

  if (entry.isSelectable) {
    score += 8;
  }

  if (entry.requiresRefinement) {
    score += 2;
  }

  return score;
}

export function searchActivities(
  query: string,
  limit = 8,
  options?: ActivitySearchOptions,
) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  return listActivitySearchEntries(options)
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, normalizedQuery),
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

export function getSuggestedActivitiesFromText(
  text: string,
  limit = 3,
  options?: ActivitySearchOptions,
) {
  if (!text.trim()) {
    return [];
  }

  return searchActivities(text, limit, {
    selectableOnly: options?.selectableOnly ?? true,
    includeSpecialAnnex: options?.includeSpecialAnnex ?? false,
  });
}
