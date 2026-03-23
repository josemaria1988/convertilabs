import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentPostingStatus } from "@/modules/accounting";
import { buildAccountingMonthRange } from "@/modules/accounting/periods";
import {
  eligibleForVatPreview,
  eligibleForVatRun,
  type VatEligibilityDecision,
  type VatEligibilityReasonCode,
} from "@/modules/tax/vat-eligibility";

type JsonRecord = Record<string, unknown>;

type PeriodDocumentRow = {
  id: string;
  current_draft_id: string | null;
  direction: "purchase" | "sale" | "other";
  status: string;
  posting_status: DocumentPostingStatus | null;
  document_date: string | null;
};

type PeriodDraftRow = {
  id: string;
  document_id: string;
  document_role: "purchase" | "sale" | "other";
  status: string;
  fields_json: JsonRecord | null;
  tax_treatment_json: JsonRecord | null;
};

type InvoiceIdentityRow = {
  document_id: string;
  duplicate_status: string | null;
};

export type VatPeriodUniverseDocument = {
  documentId: string;
  draftId: string | null;
  role: "purchase" | "sale" | "other";
  documentStatus: string;
  draftStatus: string | null;
  postingStatus: DocumentPostingStatus | null;
  documentDate: string | null;
  duplicateStatus: string | null;
  classificationResolved: boolean;
  fiscalTreatmentResolved: boolean;
  hasVatBucket: boolean;
  vatBucket: string | null;
  taxableAmountUyu: number;
  taxAmountUyu: number;
  reviewFlags: string[];
  display: {
    counterpartyName: string | null;
    issuerName: string | null;
    receiverName: string | null;
    documentNumber: string | null;
    documentType: string | null;
    currencyCode: string | null;
    totalAmount: number;
  };
  previewDecision: VatEligibilityDecision;
  runDecision: VatEligibilityDecision;
};

export type VatPeriodUniverse = {
  period: string;
  documents: VatPeriodUniverseDocument[];
  documentsInPeriod: number;
  eligibleForVatPreviewCount: number;
  excludedFromVatPreviewCount: number;
  eligibleForVatRunCount: number;
  excludedFromVatRunCount: number;
  excludedFromVatPreview: Array<{
    documentId: string;
    reasonCode: VatEligibilityReasonCode | null;
    reason: string;
  }>;
  excludedFromVatRun: Array<{
    documentId: string;
    reasonCode: VatEligibilityReasonCode | null;
    reason: string;
  }>;
};

export type VatPeriodOperationalStatus = {
  code:
    | "sin_corrida"
    | "borrador"
    | "corrida_con_base_incompleta"
    | "lista_para_revision"
    | "confirmada";
  label: string;
  summary: string;
  tone: "info" | "warning" | "success";
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function getDraftFacts(fieldsJson: JsonRecord | null) {
  return asRecord(asRecord(fieldsJson).facts);
}

function classificationLooksResolved(input: {
  documentStatus: string;
  draftStatus: string | null;
  postingStatus: DocumentPostingStatus | null;
}) {
  if (["posted_provisional", "posted_final", "locked", "vat_ready"].includes(input.postingStatus ?? "")) {
    return true;
  }

  if (input.draftStatus === "ready_for_confirmation" || input.draftStatus === "confirmed") {
    return true;
  }

  return [
    "draft_ready",
    "classified",
    "approved",
    "rejected",
  ].includes(input.documentStatus);
}

function buildUniverseDocument(input: {
  document: PeriodDocumentRow;
  draft: PeriodDraftRow | null;
  duplicateStatus: string | null;
}) {
  const taxJson = asRecord(input.draft?.tax_treatment_json);
  const facts = getDraftFacts(input.draft?.fields_json ?? null);
  const fiscalTreatmentResolved = taxJson.ready === true;
  const vatBucket =
    asString(taxJson.vat_bucket)
    ?? asString(taxJson.vatBucket)
    ?? asString(asRecord(taxJson.determination).vat_bucket);
  const classificationResolved = classificationLooksResolved({
    documentStatus: input.document.status,
    draftStatus: input.draft?.status ?? null,
    postingStatus: input.document.posting_status,
  });
  const previewDecision = eligibleForVatPreview({
    documentId: input.document.id,
    documentDate: input.document.document_date,
    postingStatus: input.document.posting_status,
    documentStatus: input.document.status,
    hasCurrentDraft: Boolean(input.document.current_draft_id && input.draft),
    classificationResolved,
    fiscalTreatmentResolved,
    hasVatBucket: Boolean(vatBucket),
    duplicateStatus: input.duplicateStatus,
  });
  const runDecision = eligibleForVatRun({
    documentId: input.document.id,
    documentDate: input.document.document_date,
    postingStatus: input.document.posting_status,
    documentStatus: input.document.status,
    hasCurrentDraft: Boolean(input.document.current_draft_id && input.draft),
    classificationResolved,
    fiscalTreatmentResolved,
    hasVatBucket: Boolean(vatBucket),
    duplicateStatus: input.duplicateStatus,
  });

  return {
    documentId: input.document.id,
    draftId: input.draft?.id ?? null,
    role: input.draft?.document_role ?? input.document.direction,
    documentStatus: input.document.status,
    draftStatus: input.draft?.status ?? null,
    postingStatus: input.document.posting_status,
    documentDate: input.document.document_date,
    duplicateStatus: input.duplicateStatus,
    classificationResolved,
    fiscalTreatmentResolved,
    hasVatBucket: Boolean(vatBucket),
    vatBucket,
    taxableAmountUyu:
      asNumber(taxJson.taxable_amount_uyu)
      || asNumber(taxJson.taxableAmountUyu)
      || asNumber(facts.subtotal),
    taxAmountUyu:
      asNumber(taxJson.tax_amount_uyu)
      || asNumber(taxJson.taxAmountUyu)
      || asNumber(facts.tax_amount),
    reviewFlags: [
      ...asStringArray(taxJson.warnings),
      ...asStringArray(taxJson.blockingReasons),
    ],
    display: {
      counterpartyName:
        input.draft?.document_role === "sale"
          ? asString(facts.receiver_name)
          : asString(facts.issuer_name),
      issuerName: asString(facts.issuer_name),
      receiverName: asString(facts.receiver_name),
      documentNumber:
        [asString(facts.series), asString(facts.document_number)]
          .filter((value): value is string => Boolean(value))
          .join("-")
        || asString(facts.document_number),
      documentType: asString(facts.document_type) ?? asString(facts.cfe_type) ?? null,
      currencyCode: asString(facts.currency_code),
      totalAmount: asNumber(facts.total_amount),
    },
    previewDecision,
    runDecision,
  } satisfies VatPeriodUniverseDocument;
}

export async function loadVatPeriodUniverse(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    period: string;
  },
) {
  const periodRange = buildAccountingMonthRange(input.period);

  if (!periodRange) {
    return {
      period: input.period,
      documents: [],
      documentsInPeriod: 0,
      eligibleForVatPreviewCount: 0,
      excludedFromVatPreviewCount: 0,
      eligibleForVatRunCount: 0,
      excludedFromVatRunCount: 0,
      excludedFromVatPreview: [],
      excludedFromVatRun: [],
    } satisfies VatPeriodUniverse;
  }

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, current_draft_id, direction, status, posting_status, document_date")
    .eq("organization_id", input.organizationId)
    .gte("document_date", periodRange.startDate)
    .lte("document_date", periodRange.endDate);

  if (documentsError) {
    throw new Error(documentsError.message);
  }

  const documentRows = (documents as PeriodDocumentRow[] | null) ?? [];
  const draftIds = documentRows
    .map((row) => row.current_draft_id)
    .filter((value): value is string => typeof value === "string");
  const documentIds = documentRows.map((row) => row.id);

  const [draftsResult, identitiesResult] = await Promise.all([
    draftIds.length > 0
      ? supabase
        .from("document_drafts")
        .select("id, document_id, document_role, status, fields_json, tax_treatment_json")
        .in("id", draftIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length > 0
      ? supabase
        .from("document_invoice_identities")
        .select("document_id, duplicate_status")
        .in("document_id", documentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (draftsResult.error) {
    throw new Error(draftsResult.error.message);
  }

  if (identitiesResult.error) {
    throw new Error(identitiesResult.error.message);
  }

  const draftsById = new Map(
    (((draftsResult.data as PeriodDraftRow[] | null) ?? [])).map((draft) => [draft.id, draft]),
  );
  const identitiesByDocumentId = new Map(
    (((identitiesResult.data as InvoiceIdentityRow[] | null) ?? []))
      .map((identity) => [identity.document_id, identity.duplicate_status]),
  );
  const universeDocuments = documentRows.map((document) =>
    buildUniverseDocument({
      document,
      draft: document.current_draft_id ? draftsById.get(document.current_draft_id) ?? null : null,
      duplicateStatus: identitiesByDocumentId.get(document.id) ?? null,
    })
  );
  const excludedFromVatPreview = universeDocuments
    .filter((document) => !document.previewDecision.ok)
    .map((document) => ({
      documentId: document.documentId,
      reasonCode: document.previewDecision.reasonCode,
      reason: document.previewDecision.reason ?? "Excluido del VAT preview.",
    }));
  const excludedFromVatRun = universeDocuments
    .filter((document) => !document.runDecision.ok)
    .map((document) => ({
      documentId: document.documentId,
      reasonCode: document.runDecision.reasonCode,
      reason: document.runDecision.reason ?? "Excluido del VAT run oficial.",
    }));

  return {
    period: input.period,
    documents: universeDocuments,
    documentsInPeriod: universeDocuments.length,
    eligibleForVatPreviewCount: universeDocuments.filter((document) => document.previewDecision.ok).length,
    excludedFromVatPreviewCount: excludedFromVatPreview.length,
    eligibleForVatRunCount: universeDocuments.filter((document) => document.runDecision.ok).length,
    excludedFromVatRunCount: excludedFromVatRun.length,
    excludedFromVatPreview,
    excludedFromVatRun,
  } satisfies VatPeriodUniverse;
}

export type VatPeriodUniverseSelection = {
  includedDocuments: VatPeriodUniverseDocument[];
  excludedDocuments: Array<{
    documentId: string;
    reasonCode: VatEligibilityReasonCode | null;
    reason: string;
  }>;
};

export function selectVatUniverseDocumentsForPreview(
  universe: VatPeriodUniverse,
) {
  return {
    includedDocuments: universe.documents.filter((document) => document.previewDecision.ok),
    excludedDocuments: universe.excludedFromVatPreview,
  } satisfies VatPeriodUniverseSelection;
}

export function selectVatUniverseDocumentsForRun(
  universe: VatPeriodUniverse,
) {
  return {
    includedDocuments: universe.documents.filter((document) => document.runDecision.ok),
    excludedDocuments: universe.excludedFromVatRun,
  } satisfies VatPeriodUniverseSelection;
}

export function describeVatPeriodOperationalStatus(input: {
  runStatus: string | null;
  reviewFlagsCount?: number;
  universe: VatPeriodUniverse;
}) {
  if (!input.runStatus) {
    return {
      code: "sin_corrida",
      label: "Sin corrida",
      summary: "Todavia no existe una corrida oficial generada para este periodo.",
      tone: "info",
    } satisfies VatPeriodOperationalStatus;
  }

  if (["finalized", "locked"].includes(input.runStatus)) {
    return {
      code: "confirmada",
      label: "Confirmada",
      summary: "El periodo ya tiene una corrida confirmada o bloqueada como referencia oficial.",
      tone: "success",
    } satisfies VatPeriodOperationalStatus;
  }

  if (
    input.universe.documentsInPeriod > 0
    && input.universe.excludedFromVatRunCount > 0
  ) {
    return {
      code: "corrida_con_base_incompleta",
      label: "Corrida con base incompleta",
      summary: "Existe una corrida, pero todavia hay documentos del periodo fuera del universo oficial.",
      tone: "warning",
    } satisfies VatPeriodOperationalStatus;
  }

  if (input.runStatus === "reviewed" || (input.reviewFlagsCount ?? 0) > 0) {
    return {
      code: "lista_para_revision",
      label: "Lista para revision",
      summary: "La corrida ya esta armada y requiere revision operativa antes de cerrarse.",
      tone: "warning",
    } satisfies VatPeriodOperationalStatus;
  }

  return {
    code: "borrador",
    label: "Borrador",
    summary: "La corrida existe, pero todavia esta abierta y puede regenerarse.",
    tone: "warning",
  } satisfies VatPeriodOperationalStatus;
}
