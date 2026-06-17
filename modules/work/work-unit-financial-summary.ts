type WorkUnitFinancialDocument = {
  direction: string;
  status: string;
  postingStatus: string | null;
  totalAmount: number | null;
};

export type WorkUnitBasicFinancialSummary = {
  revenue: number;
  cost: number;
  margin: number;
  saleDocumentCount: number;
  purchaseDocumentCount: number;
  pendingDocumentCount: number;
  blockedDocumentCount: number;
  postedDocumentCount: number;
};

function amount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isBlocked(status: string | null | undefined) {
  const normalized = status?.toLowerCase() ?? "";
  return normalized.includes("blocked") || normalized.includes("error");
}

function isPosted(status: string | null | undefined) {
  return status === "posted" || status === "posted_final" || status === "locked";
}

function isPending(status: string | null | undefined, postingStatus: string | null | undefined) {
  if (isBlocked(status) || isPosted(postingStatus)) {
    return false;
  }

  return !["approved", "confirmed", "posted", "posted_final", "locked"].includes(status ?? "");
}

export function summarizeWorkUnitDocuments(
  documents: WorkUnitFinancialDocument[],
): WorkUnitBasicFinancialSummary {
  const saleDocuments = documents.filter((document) => document.direction === "sale");
  const purchaseDocuments = documents.filter((document) => document.direction === "purchase");
  const revenue = saleDocuments.reduce((sum, document) => sum + amount(document.totalAmount), 0);
  const cost = purchaseDocuments.reduce((sum, document) => sum + amount(document.totalAmount), 0);

  return {
    revenue,
    cost,
    margin: revenue - cost,
    saleDocumentCount: saleDocuments.length,
    purchaseDocumentCount: purchaseDocuments.length,
    pendingDocumentCount: documents.filter((document) =>
      isPending(document.status, document.postingStatus)).length,
    blockedDocumentCount: documents.filter((document) => isBlocked(document.status)).length,
    postedDocumentCount: documents.filter((document) => isPosted(document.postingStatus)).length,
  };
}
