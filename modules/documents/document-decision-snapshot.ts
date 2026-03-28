import type {
  AccountRoleCode,
  DerivedDraftArtifacts,
  DocumentAssignmentRunRecord,
  DocumentPostingStatus,
} from "@/modules/accounting";
import { hasManualClassificationResolution } from "@/modules/accounting/manual-resolution";
import type { DocumentWorkflowState } from "@/modules/documents/workflow-state";
import {
  formatCanonicalNextActionLabel,
  inferBlockingActionHintFromReasons,
} from "@/modules/presentation/product-language";
import type {
  CanonicalResolutionSource,
  CanonicalWorkflowState,
} from "@/modules/presentation/product-language";
import {
  eligibleForVatPreview,
  eligibleForVatRun,
} from "@/modules/tax/vat-eligibility";

export type ResolutionSource = CanonicalResolutionSource;

export type PostingState =
  | "draft"
  | "ready_provisional"
  | "posted_provisional"
  | "ready_final"
  | "posted_final"
  | "locked";

export type EligibilityDecision = {
  ok: boolean;
  reasons: string[];
  missingConditions: string[];
};

export type DecisionChecklistItem = {
  code: string;
  label: string;
  done: boolean;
  severity: "info" | "warning" | "blocking";
  explanation?: string;
  actionHint?: string;
};

export type DocumentDecisionSnapshot = {
  workflowState: CanonicalWorkflowState;
  resolutionSource: ResolutionSource;
  resolutionConfidence: number | null;
  factualReviewResolved: boolean;
  accountingContextResolved: boolean;
  classificationResolved: boolean;
  previewBalanced: boolean;
  hasTemporaryAccounts: boolean;
  fiscalTreatmentResolved: boolean;
  postingState: PostingState;
  canPostProvisional: boolean;
  canConfirmFinal: boolean;
  provisionalEligibility: EligibilityDecision;
  finalEligibility: EligibilityDecision;
  vatPreviewEligibility: EligibilityDecision;
  vatRunEligibility: EligibilityDecision;
  blockers: string[];
  warnings: string[];
  nextBestAction: string | null;
  checklist: DecisionChecklistItem[];
};

type DraftStepStatus = {
  step_code: string;
  status: string;
  stale_reason: string | null;
};

type AccountRoleAssignmentSnapshot = {
  roleCode: AccountRoleCode;
  linePurpose: string;
  accountId: string | null;
  isMissing: boolean;
  isProvisional: boolean;
};

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim()))),
  );
}

function stepSavedOrConfirmed(step: DraftStepStatus | undefined) {
  return step ? ["draft_saved", "confirmed"].includes(step.status) : false;
}

function buildPostingState(input: {
  postingStatus: DocumentPostingStatus | null;
  workflowState: DocumentWorkflowState;
}) {
  if (input.postingStatus === "locked") {
    return "locked" satisfies PostingState;
  }

  if (input.postingStatus === "posted_final") {
    return "posted_final" satisfies PostingState;
  }

  if (input.postingStatus === "posted_provisional") {
    return "posted_provisional" satisfies PostingState;
  }

  if (input.workflowState.canConfirmFinal) {
    return "ready_final" satisfies PostingState;
  }

  if (input.workflowState.canPostProvisional || input.postingStatus === "vat_ready") {
    return "ready_provisional" satisfies PostingState;
  }

  return "draft" satisfies PostingState;
}

function hasManualResolution(derived: DerivedDraftArtifacts) {
  return Boolean(
    derived.appliedRule.accountId
    && hasManualClassificationResolution(derived.accountingContext),
  );
}

function resolveResolutionSource(input: {
  derived: DerivedDraftArtifacts;
  latestClassificationRun: DocumentAssignmentRunRecord | null;
}) {
  if (hasManualResolution(input.derived)) {
    return "manual" satisfies ResolutionSource;
  }

  if (input.derived.appliedRule.scope === "assistant") {
    return "ai" satisfies ResolutionSource;
  }

  if (
    input.derived.appliedRule.accountId
    && input.derived.appliedRule.scope !== "manual_review"
  ) {
    const assistantSuggestedAccountId = input.derived.assistantSuggestion.output?.suggestedAccountId ?? null;

    if (
      input.derived.assistantSuggestion.status === "completed"
      && assistantSuggestedAccountId
      && assistantSuggestedAccountId === input.derived.appliedRule.accountId
    ) {
      return "mixed" satisfies ResolutionSource;
    }

    return "rule" satisfies ResolutionSource;
  }

  if (
    input.latestClassificationRun?.status === "completed"
    || input.derived.assistantSuggestion.status === "completed"
  ) {
    return "ai" satisfies ResolutionSource;
  }

  return "unknown" satisfies ResolutionSource;
}

function buildEligibilityDecision(input: {
  ok: boolean;
  reasons: string[];
  missingConditions: string[];
}) {
  return {
    ok: input.ok,
    reasons: unique(input.reasons),
    missingConditions: unique(input.missingConditions),
  } satisfies EligibilityDecision;
}

function compactStrings(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim()));
}

function buildChecklist(input: {
  factualReviewResolved: boolean;
  accountingContextResolved: boolean;
  classificationResolved: boolean;
  primaryAccountDefined: boolean;
  previewBalanced: boolean;
  fiscalTreatmentResolved: boolean;
  hasTemporaryAccounts: boolean;
  blockers: string[];
  canPostProvisional: boolean;
  canConfirmFinal: boolean;
  vatPreviewEligibility: EligibilityDecision;
  vatRunEligibility: EligibilityDecision;
}) {
  return [
    {
      code: "factual_review",
      label: "Datos documentales revisados",
      done: input.factualReviewResolved,
      severity: "blocking",
      explanation: input.factualReviewResolved
        ? "Los datos basicos del comprobante ya quedaron guardados."
        : "Todavia falta validar identidad, campos o montos del comprobante.",
      actionHint: input.factualReviewResolved ? undefined : "Revisar datos del comprobante",
    },
    {
      code: "accounting_context",
      label: "Contexto contable resuelto",
      done: input.accountingContextResolved,
      severity: "blocking",
      explanation: input.accountingContextResolved
        ? "El contexto contable ya no bloquea la decision."
        : "Todavia falta contexto contable para consolidar la resolucion.",
      actionHint: input.accountingContextResolved ? undefined : "Completar contexto contable",
    },
    {
      code: "classification",
      label: "Clasificacion resuelta",
      done: input.classificationResolved,
      severity: "blocking",
      explanation: input.classificationResolved
        ? "La clasificacion ya quedo consolidada."
        : "El documento aun no tiene una resolucion contable firme.",
      actionHint: input.classificationResolved ? undefined : "Resolver clasificacion",
    },
    {
      code: "main_account",
      label: "Cuenta principal definida",
      done: input.primaryAccountDefined,
      severity: "blocking",
      explanation: input.primaryAccountDefined
        ? "La cuenta principal del asiento ya quedo definida."
        : "Todavia falta una cuenta principal o hay un rol critico sin resolver.",
      actionHint: input.primaryAccountDefined ? undefined : "Confirmar cuenta principal",
    },
    {
      code: "balanced_preview",
      label: "Asiento balanceado",
      done: input.previewBalanced,
      severity: "blocking",
      explanation: input.previewBalanced
        ? "El preview contable ya balancea Debe y Haber."
        : "El asiento todavia no balancea y no deberia postearse.",
      actionHint: input.previewBalanced ? undefined : "Revisar preview contable",
    },
    {
      code: "fiscal_treatment",
      label: "Tratamiento fiscal resuelto",
      done: input.fiscalTreatmentResolved,
      severity: "blocking",
      explanation: input.fiscalTreatmentResolved
        ? "El tratamiento fiscal ya esta consolidado."
        : "Todavia falta resolver el tratamiento fiscal del documento.",
      actionHint: input.fiscalTreatmentResolved ? undefined : "Revisar tratamiento fiscal",
    },
    {
      code: "temporary_accounts",
      label: "Sin cuentas temporales",
      done: !input.hasTemporaryAccounts,
      severity: "warning",
      explanation: input.hasTemporaryAccounts
        ? "Todavia hay cuentas provisorias dentro del asiento."
        : "No quedan cuentas temporales que bloqueen el cierre final.",
      actionHint: input.hasTemporaryAccounts ? "Cambiar cuentas provisorias" : undefined,
    },
    {
      code: "blocking_issues",
      label: "Sin bloqueos criticos",
      done: input.blockers.length === 0,
      severity: "blocking",
      explanation: input.blockers.length === 0
        ? "No quedan bloqueos activos."
        : input.blockers.join(" "),
      actionHint: input.blockers.length === 0
        ? undefined
        : inferBlockingActionHintFromReasons(input.blockers) ?? "Resolver blockers visibles",
    },
    {
      code: "provisional_ready",
      label: "Listo para posting provisional",
      done: input.canPostProvisional,
      severity: "info",
      explanation: input.canPostProvisional
        ? "Ya puede impactar en contabilidad en modo provisional."
        : "Todavia faltan condiciones para el posting provisional.",
      actionHint: input.canPostProvisional ? undefined : "Completar condiciones para provisional",
    },
    {
      code: "final_ready",
      label: "Listo para confirmacion final",
      done: input.canConfirmFinal,
      severity: "info",
      explanation: input.canConfirmFinal
        ? "Ya puede confirmarse definitivamente."
        : "Todavia faltan condiciones para la confirmacion final.",
      actionHint: input.canConfirmFinal ? undefined : "Completar condiciones para final",
    },
    {
      code: "vat_preview",
      label: "Elegible para VAT preview",
      done: input.vatPreviewEligibility.ok,
      severity: "info",
      explanation: input.vatPreviewEligibility.ok
        ? "El documento ya puede entrar al preview fiscal operativo."
        : input.vatPreviewEligibility.reasons[0] ?? "Todavia no entra al preview fiscal.",
      actionHint: input.vatPreviewEligibility.ok ? undefined : "Revisar elegibilidad fiscal",
    },
    {
      code: "vat_run",
      label: "Elegible para VAT run oficial",
      done: input.vatRunEligibility.ok,
      severity: "info",
      explanation: input.vatRunEligibility.ok
        ? "El documento ya puede entrar en la corrida oficial del periodo."
        : input.vatRunEligibility.reasons[0] ?? "Todavia no entra al VAT run oficial.",
      actionHint: input.vatRunEligibility.ok ? undefined : "Completar posting para corrida oficial",
    },
  ] satisfies DecisionChecklistItem[];
}

export function buildDocumentDecisionSnapshot(input: {
  documentStatus: string;
  postingStatus: DocumentPostingStatus | null;
  draftStatus: string;
  steps: DraftStepStatus[];
  derived: DerivedDraftArtifacts;
  workflowState: DocumentWorkflowState;
  latestClassificationRun: DocumentAssignmentRunRecord | null;
  accountRoleAssignments?: AccountRoleAssignmentSnapshot[];
  documentDate?: string | null;
  duplicateStatus?: string | null;
}) {
  const stepByCode = new Map(input.steps.map((step) => [step.step_code, step]));
  const factualReviewResolved = ["identity", "fields", "amounts"].every((stepCode) =>
    stepSavedOrConfirmed(stepByCode.get(stepCode)),
  );
  const accountingContextResolved =
    input.derived.accountingContext.status === "not_required"
    || input.derived.accountingContext.status === "provided"
    || input.derived.accountingContext.status === "assistant_completed"
    || input.derived.accountingContext.status === "manual_override"
    || stepSavedOrConfirmed(stepByCode.get("accounting_context"));
  const classificationResolved = input.workflowState.classificationStatus === "completed";
  const previewBalanced = Boolean(
    input.derived.journalSuggestion.isBalanced
    && (input.derived.journalSuggestion.totalDebit ?? 0) > 0,
  );
  const hasTemporaryAccounts = Boolean(input.derived.journalSuggestion.hasProvisionalAccounts);
  const fiscalTreatmentResolved = Boolean(input.derived.taxTreatment.ready);
  const postingState = buildPostingState({
    postingStatus: input.postingStatus,
    workflowState: input.workflowState,
  });
  const blockers = unique(input.derived.validation.blockers);
  const warnings = unique([
    ...input.workflowState.visibleWarnings,
    ...(input.derived.taxTreatment.warnings ?? []),
    ...(input.derived.settlementContext.warnings ?? []),
  ]).filter((warning) => !blockers.includes(warning));
  const primaryAssignment =
    input.accountRoleAssignments?.find((assignment) => assignment.linePurpose === "main")
    ?? input.accountRoleAssignments?.find((assignment) =>
      [
        "revenue_account",
        "expense_account",
        "inventory_account",
        "fixed_asset_account",
      ].includes(assignment.roleCode),
    )
    ?? null;
  const primaryAccountDefined = Boolean(
    primaryAssignment
      ? !primaryAssignment.isMissing && primaryAssignment.accountId
      : input.derived.appliedRule.accountId,
  );
  const resolutionSource = resolveResolutionSource({
    derived: input.derived,
    latestClassificationRun: input.latestClassificationRun,
  });
  const resolutionConfidence =
    input.latestClassificationRun?.confidence
    ?? input.derived.assistantSuggestion.confidence
    ?? null;
  const vatPreviewDecision = eligibleForVatPreview({
    documentId: "document",
    documentDate: input.documentDate ?? null,
    postingStatus: input.postingStatus,
    documentStatus: input.documentStatus,
    hasCurrentDraft: true,
    classificationResolved,
    fiscalTreatmentResolved,
    hasVatBucket: Boolean(input.derived.taxTreatment.vatBucket),
    duplicateStatus: input.duplicateStatus ?? null,
  });
  const vatRunDecision = eligibleForVatRun({
    documentId: "document",
    documentDate: input.documentDate ?? null,
    postingStatus: input.postingStatus,
    documentStatus: input.documentStatus,
    hasCurrentDraft: true,
    classificationResolved,
    fiscalTreatmentResolved,
    hasVatBucket: Boolean(input.derived.taxTreatment.vatBucket),
    duplicateStatus: input.duplicateStatus ?? null,
  });
  const provisionalEligibility = buildEligibilityDecision({
    ok: input.workflowState.canPostProvisional,
    reasons: input.workflowState.canPostProvisional ? [] : blockers,
    missingConditions: compactStrings([
      factualReviewResolved ? null : "Datos documentales revisados",
      accountingContextResolved ? null : "Contexto contable resuelto",
      classificationResolved ? null : "Clasificacion resuelta",
      primaryAccountDefined ? null : "Cuenta principal definida",
      previewBalanced ? null : "Asiento balanceado",
      fiscalTreatmentResolved ? null : "Tratamiento fiscal resuelto",
      blockers.length === 0 ? null : "Sin bloqueos criticos",
    ]),
  });
  const finalEligibility = buildEligibilityDecision({
    ok: input.workflowState.canConfirmFinal,
    reasons: input.workflowState.canConfirmFinal ? [] : blockers,
    missingConditions: compactStrings([
      ...provisionalEligibility.missingConditions,
      hasTemporaryAccounts ? "Sin cuentas temporales" : null,
    ]),
  });
  const vatPreviewEligibility = buildEligibilityDecision({
    ok: vatPreviewDecision.ok,
    reasons: vatPreviewDecision.reason ? [vatPreviewDecision.reason] : [],
    missingConditions: vatPreviewDecision.ok ? [] : ["Elegibilidad fiscal para preview"],
  });
  const vatRunEligibility = buildEligibilityDecision({
    ok: vatRunDecision.ok,
    reasons: vatRunDecision.reason ? [vatRunDecision.reason] : [],
    missingConditions: vatRunDecision.ok ? [] : ["Posting suficiente para corrida oficial"],
  });
  const checklist = buildChecklist({
    factualReviewResolved,
    accountingContextResolved,
    classificationResolved,
    primaryAccountDefined,
    previewBalanced,
    fiscalTreatmentResolved,
    hasTemporaryAccounts,
    blockers,
    canPostProvisional: input.workflowState.canPostProvisional,
    canConfirmFinal: input.workflowState.canConfirmFinal,
    vatPreviewEligibility,
    vatRunEligibility,
  });
  const canonicalWorkflowState = input.workflowState.canonicalState as CanonicalWorkflowState;
  const workflowSuggestedAction = formatCanonicalNextActionLabel(canonicalWorkflowState);
  const nextBestAction =
    input.workflowState.canConfirmFinal
      ? "Confirmar final"
      : input.workflowState.canPostProvisional
        ? "Postear provisional"
        : workflowSuggestedAction
          ?? checklist.find((item) => !item.done && item.actionHint)?.actionHint
          ?? null;

  return {
    workflowState: canonicalWorkflowState,
    resolutionSource,
    resolutionConfidence,
    factualReviewResolved,
    accountingContextResolved,
    classificationResolved,
    previewBalanced,
    hasTemporaryAccounts,
    fiscalTreatmentResolved,
    postingState,
    canPostProvisional: input.workflowState.canPostProvisional,
    canConfirmFinal: input.workflowState.canConfirmFinal,
    provisionalEligibility,
    finalEligibility,
    vatPreviewEligibility,
    vatRunEligibility,
    blockers,
    warnings,
    nextBestAction,
    checklist,
  } satisfies DocumentDecisionSnapshot;
}
