import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  loadDocumentReviewPageData,
  type DocumentReviewPageData,
} from "@/modules/documents/review";
import type { DocumentDirection } from "@/modules/documents/status";
import { buildDocumentOperationalHeaderView } from "@/modules/presentation/document-decision-view";
import { formatCanonicalResolutionSourceLabel } from "@/modules/presentation/product-language";
import {
  loadTaxPeriodDocumentSelections,
  type TaxPeriodDocumentSelection,
  type TaxPeriodDocumentSelectionStatus,
} from "@/modules/tax/tax-period-decisions";
import {
  loadVatPeriodUniverse,
  type VatPeriodUniverse,
  type VatPeriodUniverseDocument,
} from "@/modules/tax/vat-period-universe";
import type { OrganizationVatRun } from "@/modules/tax/vat-runs";

export type TaxPeriodWorkbenchStateFilter =
  | "all"
  | "detected"
  | "needs_review"
  | "eligible"
  | "confirmed"
  | "excluded"
  | "included_in_run";

export type TaxPeriodWorkbenchDirectionFilter =
  | "all"
  | "purchase"
  | "sale";

export type TaxPeriodWorkbenchTaxState =
  | "detected_in_period"
  | "eligible_for_preview"
  | "needs_fiscal_review"
  | "confirmed_for_period"
  | "excluded_from_period"
  | "included_in_official_run";

export type TaxPeriodWorkbenchFilters = {
  state: TaxPeriodWorkbenchStateFilter;
  direction: TaxPeriodWorkbenchDirectionFilter;
  manualResolution: "all" | "without_manual";
  query: string;
  page: number;
  pageSize: number;
  focusDocumentId: string | null;
};

export type TaxPeriodWorkbenchItem = {
  documentId: string;
  reviewHref: string;
  workflowState: DocumentReviewPageData["decisionSnapshot"]["workflowState"];
  workflowLabel: string;
  resolutionSource: DocumentReviewPageData["decisionSnapshot"]["resolutionSource"];
  resolutionSourceLabel: string;
  postingStateLabel: string;
  classificationLabel: string;
  taxState: TaxPeriodWorkbenchTaxState;
  taxStateLabel: string;
  taxStateSummary: string;
  nextBestAction: string | null;
  canRunClassification: boolean;
  canOpenManualResolve: boolean;
  canConfirmManual: boolean;
  canPostProvisional: boolean;
  canConfirmForPeriod: boolean;
  canExcludeFromPeriod: boolean;
  canIncludeInOfficialRun: boolean;
  display: {
    title: string;
    subtitle: string;
    counterpartyName: string | null;
    documentNumber: string | null;
    issueDate: string | null;
    totalAmount: number;
    currencyCode: string | null;
    documentType: string | null;
    direction: DocumentDirection;
    impactLabel: string;
    impactAmount: number;
  };
  provisionalSummary: string;
  finalSummary: string;
  vatPreviewSummary: string;
  vatRunSummary: string;
  blockersCount: number;
  warningsCount: number;
  periodSelectionStatus: TaxPeriodDocumentSelectionStatus | null;
  periodSelectionNote: string | null;
};

export type TaxPeriodWorkbenchData = {
  universe: VatPeriodUniverse;
  periodSelectionCount: number;
  summary: {
    totalDocuments: number;
    pendingDocuments: number;
    eligibleDocuments: number;
    confirmedDocuments: number;
    excludedDocuments: number;
    includedInOfficialRunDocuments: number;
    draftNetVat: number;
    confirmedNetVat: number;
  };
  filters: TaxPeriodWorkbenchFilters;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  items: TaxPeriodWorkbenchItem[];
  focusItem: TaxPeriodWorkbenchItem | null;
  focusPageData: DocumentReviewPageData | null;
};

type WorkbenchStateDraft = {
  taxState: TaxPeriodWorkbenchTaxState;
  taxStateLabel: string;
  taxStateSummary: string;
};

function normalizeQuery(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePage(value: number | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
}

function formatMoney(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : 0;

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildWorkbenchTitle(document: VatPeriodUniverseDocument) {
  const documentNumber = document.display.documentNumber ?? "Sin numero";
  const counterparty = document.display.counterpartyName ?? "Sin contraparte";

  return `${documentNumber} · ${counterparty}`;
}

function buildWorkbenchSubtitle(document: VatPeriodUniverseDocument) {
  const currency = document.display.currencyCode ?? "UYU";
  const issueDate = document.documentDate ?? "Sin fecha";

  return `${currency} ${formatMoney(document.display.totalAmount)} · ${issueDate}`;
}

function buildImpact(document: VatPeriodUniverseDocument) {
  if (document.role === "sale") {
    return {
      label: "Debito fiscal",
      amount: document.taxAmountUyu,
    };
  }

  if (document.vatBucket === "input_non_deductible") {
    return {
      label: "IVA no deducible",
      amount: document.taxAmountUyu,
    };
  }

  return {
    label: "Credito fiscal",
    amount: document.taxAmountUyu,
  };
}

export function deriveTaxPeriodWorkbenchState(input: {
  document: VatPeriodUniverseDocument;
  selection: TaxPeriodDocumentSelection | null;
  includedInOfficialRun: boolean;
}) {
  if (input.includedInOfficialRun) {
    return {
      taxState: "included_in_official_run",
      taxStateLabel: "Incluido en corrida",
      taxStateSummary: "Ya forma parte de la ultima corrida oficial del periodo.",
    } satisfies WorkbenchStateDraft;
  }

  if (input.selection?.selectionStatus === "excluded_from_period") {
    return {
      taxState: "excluded_from_period",
      taxStateLabel: "Excluido del periodo",
      taxStateSummary:
        input.selection.note?.trim()
        || "Fue excluido manualmente de la liquidacion del periodo.",
    } satisfies WorkbenchStateDraft;
  }

  if (input.selection?.selectionStatus === "confirmed_for_period") {
    return {
      taxState: "confirmed_for_period",
      taxStateLabel: "Confirmado para periodo",
      taxStateSummary: "Ya fue aceptado para la liquidacion del mes y espera corrida oficial.",
    } satisfies WorkbenchStateDraft;
  }

  if (!input.document.previewDecision.ok) {
    const detectedReasonCodes = new Set(["missing_document_date", "missing_draft"]);

    if (
      input.document.previewDecision.reasonCode
      && detectedReasonCodes.has(input.document.previewDecision.reasonCode)
    ) {
      return {
        taxState: "detected_in_period",
        taxStateLabel: "Detectado en periodo",
        taxStateSummary:
          input.document.previewDecision.reason
          ?? "El documento existe en el periodo, pero todavia no tiene base suficiente para trabajo fiscal.",
      } satisfies WorkbenchStateDraft;
    }

    return {
      taxState: "needs_fiscal_review",
      taxStateLabel: "Necesita revision fiscal",
      taxStateSummary:
        input.document.previewDecision.reason
        ?? "Todavia faltan condiciones para trabajar fiscalmente este documento.",
    } satisfies WorkbenchStateDraft;
  }

  return {
    taxState: "eligible_for_preview",
    taxStateLabel: "Elegible",
    taxStateSummary: input.document.runDecision.ok
      ? "Ya puede confirmarse para la liquidacion del periodo."
      : input.document.runDecision.reason
        ?? "Entra al preview, pero todavia falta posting para la corrida oficial.",
  } satisfies WorkbenchStateDraft;
}

function matchesWorkbenchFilter(input: {
  document: VatPeriodUniverseDocument;
  itemState: TaxPeriodWorkbenchTaxState;
  selection: TaxPeriodDocumentSelection | null;
  filters: TaxPeriodWorkbenchFilters;
}) {
  if (
    input.filters.direction !== "all"
    && input.document.role !== input.filters.direction
  ) {
    return false;
  }

  if (
    input.filters.manualResolution === "without_manual"
    && input.selection?.metadata?.resolution_source === "manual"
  ) {
    return false;
  }

  if (input.filters.state !== "all") {
    const stateMatches = (
      (input.filters.state === "detected" && input.itemState === "detected_in_period")
      || (input.filters.state === "needs_review" && input.itemState === "needs_fiscal_review")
      || (input.filters.state === "eligible" && input.itemState === "eligible_for_preview")
      || (input.filters.state === "confirmed" && input.itemState === "confirmed_for_period")
      || (input.filters.state === "excluded" && input.itemState === "excluded_from_period")
      || (input.filters.state === "included_in_run" && input.itemState === "included_in_official_run")
    );

    if (!stateMatches) {
      return false;
    }
  }

  const query = normalizeQuery(input.filters.query);

  if (!query) {
    return true;
  }

  const haystack = [
    input.document.display.counterpartyName,
    input.document.display.issuerName,
    input.document.display.receiverName,
    input.document.display.documentNumber,
    input.document.display.documentType,
    input.document.documentDate,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function buildWorkbenchItem(input: {
  pageData: DocumentReviewPageData;
  universeDocument: VatPeriodUniverseDocument;
  selection: TaxPeriodDocumentSelection | null;
  includedInOfficialRun: boolean;
}) {
  const header = buildDocumentOperationalHeaderView(input.pageData.decisionSnapshot);
  const workbenchState = deriveTaxPeriodWorkbenchState({
    document: input.universeDocument,
    selection: input.selection,
    includedInOfficialRun: input.includedInOfficialRun,
  });
  const impact = buildImpact(input.universeDocument);

  return {
    documentId: input.pageData.document.id,
    reviewHref: `/app/o/${input.pageData.organizationSlug}/documents/${input.pageData.document.id}`,
    workflowState: input.pageData.decisionSnapshot.workflowState,
    workflowLabel: header.workflowLabel,
    resolutionSource: input.pageData.decisionSnapshot.resolutionSource,
    resolutionSourceLabel: formatCanonicalResolutionSourceLabel(input.pageData.decisionSnapshot.resolutionSource),
    postingStateLabel: header.postingStateLabel,
    classificationLabel: input.pageData.decisionSnapshot.classificationResolved
      ? "Resuelta"
      : "Pendiente",
    taxState: workbenchState.taxState,
    taxStateLabel: workbenchState.taxStateLabel,
    taxStateSummary: workbenchState.taxStateSummary,
    nextBestAction: input.pageData.decisionSnapshot.nextBestAction,
    canRunClassification: input.pageData.canRunClassification,
    canOpenManualResolve: true,
    canConfirmManual:
      input.pageData.decisionSnapshot.classificationResolved
      && input.pageData.decisionSnapshot.resolutionSource !== "manual",
    canPostProvisional: input.pageData.canPostProvisional,
    canConfirmForPeriod:
      input.pageData.decisionSnapshot.vatRunEligibility.ok
      && workbenchState.taxState !== "included_in_official_run",
    canExcludeFromPeriod: workbenchState.taxState !== "included_in_official_run",
    canIncludeInOfficialRun: workbenchState.taxState === "included_in_official_run",
    display: {
      title: buildWorkbenchTitle(input.universeDocument),
      subtitle: buildWorkbenchSubtitle(input.universeDocument),
      counterpartyName: input.universeDocument.display.counterpartyName,
      documentNumber: input.universeDocument.display.documentNumber,
      issueDate: input.universeDocument.documentDate,
      totalAmount: input.universeDocument.display.totalAmount,
      currencyCode: input.universeDocument.display.currencyCode,
      documentType: input.universeDocument.display.documentType,
      direction: input.pageData.document.direction,
      impactLabel: impact.label,
      impactAmount: impact.amount,
    },
    provisionalSummary: header.provisional.summary,
    finalSummary: header.final.summary,
    vatPreviewSummary:
      input.pageData.decisionSnapshot.vatPreviewEligibility.reasons[0]
      ?? "Ya entra al preview fiscal del periodo.",
    vatRunSummary:
      input.pageData.decisionSnapshot.vatRunEligibility.reasons[0]
      ?? "Ya puede entrar en la corrida oficial del periodo.",
    blockersCount: input.pageData.decisionSnapshot.blockers.length,
    warningsCount: input.pageData.decisionSnapshot.warnings.length,
    periodSelectionStatus: input.selection?.selectionStatus ?? null,
    periodSelectionNote: input.selection?.note ?? null,
  } satisfies TaxPeriodWorkbenchItem;
}

function buildFallbackWorkbenchItem(input: {
  organizationSlug: string;
  document: VatPeriodUniverseDocument;
  selection: TaxPeriodDocumentSelection | null;
  includedInOfficialRun: boolean;
}) {
  const workbenchState = deriveTaxPeriodWorkbenchState({
    document: input.document,
    selection: input.selection,
    includedInOfficialRun: input.includedInOfficialRun,
  });
  const impact = buildImpact(input.document);

  return {
    documentId: input.document.documentId,
    reviewHref: `/app/o/${input.organizationSlug}/documents/${input.document.documentId}`,
    workflowState: "processing",
    workflowLabel: "Procesando",
    resolutionSource: "unknown",
    resolutionSourceLabel: "Pendiente",
    postingStateLabel: input.document.postingStatus ?? "Sin posting",
    classificationLabel: input.document.classificationResolved ? "Resuelta" : "Pendiente",
    taxState: workbenchState.taxState,
    taxStateLabel: workbenchState.taxStateLabel,
    taxStateSummary: workbenchState.taxStateSummary,
    nextBestAction:
      workbenchState.taxState === "detected_in_period"
        ? "Abrir reviewer completo"
        : "Resolver clasificacion",
    canRunClassification: Boolean(input.document.draftId),
    canOpenManualResolve: false,
    canConfirmManual: false,
    canPostProvisional: false,
    canConfirmForPeriod: false,
    canExcludeFromPeriod: true,
    canIncludeInOfficialRun: false,
    display: {
      title: buildWorkbenchTitle(input.document),
      subtitle: buildWorkbenchSubtitle(input.document),
      counterpartyName: input.document.display.counterpartyName,
      documentNumber: input.document.display.documentNumber,
      issueDate: input.document.documentDate,
      totalAmount: input.document.display.totalAmount,
      currencyCode: input.document.display.currencyCode,
      documentType: input.document.display.documentType,
      direction: input.document.role,
      impactLabel: impact.label,
      impactAmount: impact.amount,
    },
    provisionalSummary: "Todavia no hay base suficiente para postear provisionalmente.",
    finalSummary: "Todavia no hay base suficiente para confirmar final.",
    vatPreviewSummary: input.document.previewDecision.reason ?? "Sin resumen fiscal disponible.",
    vatRunSummary: input.document.runDecision.reason ?? "Sin resumen fiscal disponible.",
    blockersCount: input.document.previewDecision.ok ? 0 : 1,
    warningsCount: input.document.reviewFlags.length,
    periodSelectionStatus: input.selection?.selectionStatus ?? null,
    periodSelectionNote: input.selection?.note ?? null,
  } satisfies TaxPeriodWorkbenchItem;
}

function computeNetVat(input: {
  documents: VatPeriodUniverseDocument[];
}) {
  return input.documents.reduce((accumulator, document) => {
    if (document.role === "sale") {
      return accumulator + document.taxAmountUyu;
    }

    if (document.vatBucket === "input_non_deductible") {
      return accumulator + document.taxAmountUyu;
    }

    return accumulator - document.taxAmountUyu;
  }, 0);
}

export async function loadTaxPeriodWorkbenchData(input: {
  organizationId: string;
  organizationSlug: string;
  userRole: DocumentReviewPageData["userRole"];
  actorId: string | null;
  period: string;
  filters: Partial<TaxPeriodWorkbenchFilters>;
  selectedRun: OrganizationVatRun | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const [universe, selectionResult] = await Promise.all([
    loadVatPeriodUniverse(supabase, {
      organizationId: input.organizationId,
      period: input.period,
    }),
    loadTaxPeriodDocumentSelections(supabase, {
      organizationId: input.organizationId,
      period: input.period,
    }),
  ]);
  const filters: TaxPeriodWorkbenchFilters = {
    state: input.filters.state ?? "all",
    direction: input.filters.direction ?? "all",
    manualResolution: input.filters.manualResolution ?? "all",
    query: input.filters.query ?? "",
    page: normalizePage(input.filters.page),
    pageSize: input.filters.pageSize ?? 25,
    focusDocumentId: input.filters.focusDocumentId ?? null,
  };
  const selectionsByDocumentId = new Map(
    selectionResult.selections.map((selection) => [selection.documentId, selection]),
  );
  const includedInOfficialRun = new Set(
    (input.selectedRun?.tracedDocuments ?? []).map((document) => document.documentId),
  );
  const filteredDocuments = universe.documents.filter((document) => {
    const state = deriveTaxPeriodWorkbenchState({
      document,
      selection: selectionsByDocumentId.get(document.documentId) ?? null,
      includedInOfficialRun: includedInOfficialRun.has(document.documentId),
    });

    return matchesWorkbenchFilter({
      document,
      itemState: state.taxState,
      selection: selectionsByDocumentId.get(document.documentId) ?? null,
      filters,
    });
  });
  const totalItems = filteredDocuments.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const pageStart = (page - 1) * filters.pageSize;
  const visibleDocuments = filteredDocuments.slice(pageStart, pageStart + filters.pageSize);
  const visibleDocumentIds = visibleDocuments.map((document) => document.documentId);
  const focusDocumentId = filters.focusDocumentId;
  const focusNeedsExtraLoad =
    focusDocumentId
    && !visibleDocumentIds.includes(focusDocumentId)
    && universe.documents.some((document) => document.documentId === focusDocumentId);
  const pageDataList: Array<DocumentReviewPageData | null> = await Promise.all(
    visibleDocuments.map(async (document) => {
      if (!document.draftId) {
        return null;
      }

      try {
        return await loadDocumentReviewPageData({
          organizationId: input.organizationId,
          organizationSlug: input.organizationSlug,
          documentId: document.documentId,
          actorId: input.actorId,
          userRole: input.userRole,
        });
      } catch {
        return null;
      }
    }),
  );
  const pageDataByDocumentId = new Map<string, DocumentReviewPageData>();

  for (const pageData of pageDataList) {
    if (!pageData) {
      continue;
    }

    pageDataByDocumentId.set(pageData.document.id, pageData);
  }
  let focusPageData = focusDocumentId
    ? pageDataByDocumentId.get(focusDocumentId) ?? null
    : null;

  if (focusNeedsExtraLoad && focusDocumentId) {
    try {
      focusPageData = await loadDocumentReviewPageData({
        organizationId: input.organizationId,
        organizationSlug: input.organizationSlug,
        documentId: focusDocumentId,
        actorId: input.actorId,
        userRole: input.userRole,
      });
    } catch {
      focusPageData = null;
    }
  }

  const items: TaxPeriodWorkbenchItem[] = visibleDocuments
    .map((document) => {
      const pageData = pageDataByDocumentId.get(document.documentId);

      if (!pageData) {
        return buildFallbackWorkbenchItem({
          organizationSlug: input.organizationSlug,
          document,
          selection: selectionsByDocumentId.get(document.documentId) ?? null,
          includedInOfficialRun: includedInOfficialRun.has(document.documentId),
        });
      }

      return buildWorkbenchItem({
        pageData,
        universeDocument: document,
        selection: selectionsByDocumentId.get(document.documentId) ?? null,
        includedInOfficialRun: includedInOfficialRun.has(document.documentId),
      });
    });
  const focusUniverseDocument = focusPageData
    ? universe.documents.find((document) => document.documentId === focusPageData.document.id) ?? null
    : null;
  const focusItem =
    focusUniverseDocument
      ? focusPageData
        ? buildWorkbenchItem({
          pageData: focusPageData,
          universeDocument: focusUniverseDocument,
          selection: selectionsByDocumentId.get(focusPageData.document.id) ?? null,
          includedInOfficialRun: includedInOfficialRun.has(focusPageData.document.id),
        })
        : buildFallbackWorkbenchItem({
          organizationSlug: input.organizationSlug,
          document: focusUniverseDocument,
          selection: selectionsByDocumentId.get(focusUniverseDocument.documentId) ?? null,
          includedInOfficialRun: includedInOfficialRun.has(focusUniverseDocument.documentId),
        })
      : null;
  const allStates = universe.documents.map((document) =>
    deriveTaxPeriodWorkbenchState({
      document,
      selection: selectionsByDocumentId.get(document.documentId) ?? null,
      includedInOfficialRun: includedInOfficialRun.has(document.documentId),
    })
  );
  const confirmedDocuments = allStates.filter((state) =>
    state.taxState === "confirmed_for_period" || state.taxState === "included_in_official_run")
    .length;
  const excludedDocuments = allStates.filter((state) => state.taxState === "excluded_from_period").length;
  const includedInOfficialRunDocuments = allStates.filter((state) => state.taxState === "included_in_official_run").length;
  const eligibleDocuments = allStates.filter((state) => state.taxState === "eligible_for_preview").length;
  const pendingDocuments = allStates.filter((state) =>
    ["detected_in_period", "needs_fiscal_review", "eligible_for_preview"].includes(state.taxState))
    .length;
  const confirmedSet = universe.documents.filter((document) => {
    const state = deriveTaxPeriodWorkbenchState({
      document,
      selection: selectionsByDocumentId.get(document.documentId) ?? null,
      includedInOfficialRun: includedInOfficialRun.has(document.documentId),
    });

    return state.taxState === "confirmed_for_period" || state.taxState === "included_in_official_run";
  });

  return {
    universe,
    periodSelectionCount: selectionResult.selections.length,
    summary: {
      totalDocuments: universe.documentsInPeriod,
      pendingDocuments,
      eligibleDocuments,
      confirmedDocuments,
      excludedDocuments,
      includedInOfficialRunDocuments,
      draftNetVat: computeNetVat({
        documents: universe.documents.filter((document) => document.previewDecision.ok),
      }),
      confirmedNetVat: computeNetVat({
        documents: confirmedSet,
      }),
    },
    filters: {
      ...filters,
      page,
    },
    pagination: {
      page,
      pageSize: filters.pageSize,
      totalItems,
      totalPages,
    },
    items,
    focusItem,
    focusPageData,
  } satisfies TaxPeriodWorkbenchData;
}
