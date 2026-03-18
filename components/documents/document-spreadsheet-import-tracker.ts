const STORAGE_PREFIX = "convertilabs:document-spreadsheet-imports";

function getStorageKey(slug: string) {
  return `${STORAGE_PREFIX}:${slug}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readPendingDocumentSpreadsheetImportRunIds(slug: string) {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getStorageKey(slug));

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function writePendingDocumentSpreadsheetImportRunIds(slug: string, runIds: string[]) {
  if (!canUseStorage()) {
    return;
  }

  const uniqueRunIds = Array.from(new Set(runIds.filter(Boolean)));

  if (uniqueRunIds.length === 0) {
    window.localStorage.removeItem(getStorageKey(slug));
    return;
  }

  window.localStorage.setItem(getStorageKey(slug), JSON.stringify(uniqueRunIds));
}

export function rememberPendingDocumentSpreadsheetImportRun(slug: string, runId: string) {
  writePendingDocumentSpreadsheetImportRunIds(slug, [
    ...readPendingDocumentSpreadsheetImportRunIds(slug),
    runId,
  ]);
}

export function forgetPendingDocumentSpreadsheetImportRun(slug: string, runId: string) {
  writePendingDocumentSpreadsheetImportRunIds(
    slug,
    readPendingDocumentSpreadsheetImportRunIds(slug).filter((candidate) => candidate !== runId),
  );
}

export function readLatestPendingDocumentSpreadsheetImportRunId(slug: string) {
  const runIds = readPendingDocumentSpreadsheetImportRunIds(slug);

  return runIds.length > 0 ? runIds[runIds.length - 1] ?? null : null;
}
