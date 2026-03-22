import type { DocumentPostingStatus } from "@/modules/accounting";

export type VatEligibilityReasonCode =
  | "missing_document_date"
  | "missing_draft"
  | "classification_unresolved"
  | "fiscal_treatment_incomplete"
  | "missing_vat_bucket"
  | "reopened_document"
  | "archived_or_duplicate"
  | "insufficient_posting_for_preview"
  | "insufficient_posting_for_run";

export type VatEligibilitySnapshot = {
  documentId: string;
  documentDate: string | null;
  postingStatus: DocumentPostingStatus | null;
  documentStatus: string | null;
  hasCurrentDraft: boolean;
  classificationResolved: boolean;
  fiscalTreatmentResolved: boolean;
  hasVatBucket: boolean;
  duplicateStatus?: string | null;
};

export type VatEligibilityDecision = {
  ok: boolean;
  reasonCode: VatEligibilityReasonCode | null;
  reason: string | null;
};

function archivedOrDuplicate(snapshot: VatEligibilitySnapshot) {
  return snapshot.documentStatus === "archived"
    || snapshot.documentStatus === "duplicate"
    || snapshot.duplicateStatus === "confirmed_duplicate";
}

function reopenedDocument(snapshot: VatEligibilitySnapshot) {
  return snapshot.documentStatus === "classified_with_open_revision";
}

function buildBaseFailure(
  snapshot: VatEligibilitySnapshot,
): VatEligibilityDecision | null {
  if (!snapshot.documentDate) {
    return {
      ok: false,
      reasonCode: "missing_document_date",
      reason: "Falta la fecha documental para ubicarlo en el periodo fiscal.",
    };
  }

  if (!snapshot.hasCurrentDraft) {
    return {
      ok: false,
      reasonCode: "missing_draft",
      reason: "No tiene draft actual listo para entrar en evaluacion fiscal.",
    };
  }

  if (archivedOrDuplicate(snapshot)) {
    return {
      ok: false,
      reasonCode: "archived_or_duplicate",
      reason: "El documento esta archivado o marcado como duplicado y no entra al universo fiscal operativo.",
    };
  }

  if (reopenedDocument(snapshot)) {
    return {
      ok: false,
      reasonCode: "reopened_document",
      reason: "El documento fue reabierto y requiere remap antes de volver al flujo fiscal.",
    };
  }

  if (!snapshot.classificationResolved) {
    return {
      ok: false,
      reasonCode: "classification_unresolved",
      reason: "La clasificacion contable todavia no quedo resuelta.",
    };
  }

  if (!snapshot.fiscalTreatmentResolved) {
    return {
      ok: false,
      reasonCode: "fiscal_treatment_incomplete",
      reason: "El tratamiento fiscal todavia no quedo resuelto.",
    };
  }

  if (!snapshot.hasVatBucket) {
    return {
      ok: false,
      reasonCode: "missing_vat_bucket",
      reason: "Todavia no hay bucket de IVA consolidado para este documento.",
    };
  }

  return null;
}

export function eligibleForVatPreview(snapshot: VatEligibilitySnapshot): VatEligibilityDecision {
  const baseFailure = buildBaseFailure(snapshot);

  if (baseFailure) {
    return baseFailure;
  }

  if (!["vat_ready", "posted_provisional", "posted_final"].includes(snapshot.postingStatus ?? "")) {
    return {
      ok: false,
      reasonCode: "insufficient_posting_for_preview",
      reason: "El documento sigue en draft y todavia no alcanzo un estado contable suficiente para el preview fiscal.",
    };
  }

  return {
    ok: true,
    reasonCode: null,
    reason: null,
  };
}

export function eligibleForVatRun(snapshot: VatEligibilitySnapshot): VatEligibilityDecision {
  const baseFailure = buildBaseFailure(snapshot);

  if (baseFailure) {
    return baseFailure;
  }

  if (!["posted_provisional", "posted_final"].includes(snapshot.postingStatus ?? "")) {
    return {
      ok: false,
      reasonCode: "insufficient_posting_for_run",
      reason: "Aun no tiene posting suficiente para entrar en la corrida oficial de IVA.",
    };
  }

  return {
    ok: true,
    reasonCode: null,
    reason: null,
  };
}
