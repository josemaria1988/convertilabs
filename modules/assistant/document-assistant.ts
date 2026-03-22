import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAIModelConfig } from "@/lib/env";
import { createStructuredOpenAIResponse } from "@/lib/llm/openai-responses";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseRelationError,
} from "@/lib/supabase/schema-compat";
import type {
  DocumentIntakeFactMap,
  DocumentRoleCandidate,
} from "@/modules/ai/document-intake-contract";
import type {
  AccountRoleCode,
  DerivedDraftArtifacts,
  DocumentAssignmentRunRecord,
} from "@/modules/accounting";
import { computeKernelHash } from "@/modules/accounting/kernel";
import type { DocumentWorkflowState } from "@/modules/documents/workflow-state";
import {
  ACCOUNTING_ASSISTANT_DISPLAY_NAME,
  ACCOUNTING_ASSISTANT_SYSTEM_ACTOR_ID,
  DOCUMENT_REVIEWER_ASSISTANT_CODE,
  getAssistantPersonaPresentation,
  type AssistantPersonaCode,
  type AssistantPersonaPresentation,
} from "@/modules/assistant/personas";
import {
  recordAssistantRun,
  supersedePendingAssistantSuggestions,
} from "@/modules/assistant/runs";

type JsonRecord = Record<string, unknown>;

type OrganizationMemberRole =
  | "owner"
  | "admin"
  | "admin_processing"
  | "accountant"
  | "reviewer"
  | "operator"
  | "viewer"
  | "developer";

type ReviewAccountRoleAssignment = {
  roleCode: AccountRoleCode;
  linePurpose: string;
  accountId: string | null;
  accountLabel: string | null;
  isMissing: boolean;
  isProvisional: boolean;
  provenance: string | null;
  editable: boolean;
};

type LearningSuggestionsInput = {
  recommendedScope:
    | "none"
    | "document_override"
    | "vendor_concept_operation_category"
    | "vendor_concept"
    | "concept_global"
    | "vendor_default";
  options: Array<{
    scope:
      | "vendor_concept_operation_category"
      | "vendor_concept"
      | "concept_global"
      | "vendor_default";
    label: string;
    reason: string;
    recommended: boolean;
    requiresConceptName: boolean;
  }>;
};

export type DocumentAssistantSnapshotInput = {
  organizationId: string;
  document: {
    id: string;
    status: string;
    postingStatus: string | null;
    originalFilename: string;
  };
  draft: {
    id: string;
    revisionNumber: number;
    status: string;
    documentRole: DocumentRoleCandidate;
    documentType: string;
  };
  actorId: string | null;
  facts: DocumentIntakeFactMap;
  derived: DerivedDraftArtifacts;
  workflowState: DocumentWorkflowState;
  latestClassificationRun: DocumentAssignmentRunRecord | null;
  learningSuggestions: LearningSuggestionsInput;
  accountRoleAssignments: ReviewAccountRoleAssignment[];
  certaintyConfidence: number | null;
};

type AssistantThreadRow = {
  id: string;
  organization_id: string;
  target_kind: string;
  target_id: string;
  persona_code: string;
  opened_by_profile_id: string | null;
  status: string;
  current_input_hash: string | null;
  stale_reason: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentAssistantSuggestionType =
  | "needs_context"
  | "classification_review"
  | "stale_recalculation"
  | "posting_readiness"
  | "learning_scope_recommendation";

type AssistantSuggestionActionKind =
  | "review_context"
  | "run_classification"
  | "post_provisional"
  | "open_learning";

type AssistantMessageStructuredPayload = {
  summaryMd: string;
  whatISee: string[];
  whatISuggest: string[];
  whatYouCanDecideNow: string[];
  warnings: string[];
  confidence: number | null;
  needsRefresh: boolean;
};

type AssistantMessageRow = {
  id: string;
  thread_id: string;
  role: string;
  persona_code: string | null;
  created_by_profile_id: string | null;
  system_actor_id: string | null;
  assistant_run_id: string | null;
  content_md: string;
  structured_payload_json: JsonRecord | null;
  created_at: string;
};

type AssistantSuggestionRow = {
  id: string;
  assistant_run_id: string;
  thread_id: string | null;
  message_id: string | null;
  suggestion_type: DocumentAssistantSuggestionType;
  proposed_payload_json: JsonRecord | null;
  input_hash: string | null;
  evidence_hash: string | null;
  confidence: number | null;
  rationale_md: string | null;
  requested_by_profile_id: string | null;
  resolution_status: string;
  resolved_by_profile_id: string | null;
  resolved_at: string | null;
  resolution_comment: string | null;
  created_at: string;
};

export type DocumentAssistantSuggestionView = {
  id: string;
  suggestionType: DocumentAssistantSuggestionType;
  title: string;
  description: string;
  actionKind: AssistantSuggestionActionKind | null;
  actionLabel: string | null;
  payloadJson: JsonRecord;
  confidence: number | null;
  rationaleMarkdown: string | null;
  resolutionStatus: string;
  resolvedAt: string | null;
};

export type DocumentAssistantRailData = {
  persona: AssistantPersonaPresentation;
  thread: {
    id: string;
    status: string;
    staleReason: string | null;
    currentInputHash: string | null;
    lastMessageAt: string | null;
  } | null;
  latestMessage: {
    id: string;
    contentMd: string;
    structuredPayload: AssistantMessageStructuredPayload;
    createdAt: string;
  } | null;
  recentMessages: Array<{
    id: string;
    contentMd: string;
    createdAt: string;
  }>;
  suggestions: DocumentAssistantSuggestionView[];
  canRefresh: boolean;
  isStale: boolean;
  currentInputHash: string;
};

type DeterministicSuggestion = {
  suggestionType: DocumentAssistantSuggestionType;
  title: string;
  description: string;
  actionKind: AssistantSuggestionActionKind | null;
  actionLabel: string | null;
  payloadJson: JsonRecord;
  confidence: number | null;
  rationaleMarkdown: string | null;
};

type DeterministicDocumentAssistantAnalysis = {
  inputHash: string;
  evidenceHash: string;
  summaryMd: string;
  whatISee: string[];
  whatISuggest: string[];
  whatYouCanDecideNow: string[];
  warnings: string[];
  confidence: number | null;
  suggestions: DeterministicSuggestion[];
  requestPayloadJson: JsonRecord;
  responsePayloadJson: JsonRecord;
  provider: string | null;
  model: string | null;
  rationaleMarkdown: string;
};

const consultiveVisibleRoles = new Set<OrganizationMemberRole>([
  "owner",
  "admin",
  "admin_processing",
  "accountant",
  "reviewer",
]);

const documentAssistantNarrativeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summaryMd",
    "whatISee",
    "whatISuggest",
    "whatYouCanDecideNow",
    "warnings",
    "confidence",
  ],
  properties: {
    summaryMd: { type: "string" },
    whatISee: { type: "array", items: { type: "string" } },
    whatISuggest: { type: "array", items: { type: "string" } },
    whatYouCanDecideNow: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function isNarrativePayload(
  value: unknown,
): value is Omit<AssistantMessageStructuredPayload, "needsRefresh"> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.summaryMd === "string"
    && Array.isArray(record.whatISee)
    && record.whatISee.every((entry) => typeof entry === "string")
    && Array.isArray(record.whatISuggest)
    && record.whatISuggest.every((entry) => typeof entry === "string")
    && Array.isArray(record.whatYouCanDecideNow)
    && record.whatYouCanDecideNow.every((entry) => typeof entry === "string")
    && Array.isArray(record.warnings)
    && record.warnings.every((entry) => typeof entry === "string")
    && typeof record.confidence === "number"
  );
}

function canAccessDocumentAssistant(userRole: OrganizationMemberRole) {
  return consultiveVisibleRoles.has(userRole);
}

function formatDocumentRoleLabel(value: DocumentRoleCandidate) {
  switch (value) {
    case "purchase":
      return "Compra";
    case "sale":
      return "Venta";
    default:
      return "Documento";
  }
}

function formatPaymentTerms(value: string | null | undefined) {
  switch (value) {
    case "cash":
      return "contado";
    case "credit":
      return "credito";
    default:
      return "condicion pendiente";
  }
}

function formatSettlementMethod(value: string | null | undefined) {
  switch (value) {
    case "bank_transfer":
      return "banco o transferencia";
    case "cash":
      return "caja o efectivo";
    case "card":
      return "tarjeta";
    case "check":
      return "cheque";
    default:
      return "medio pendiente";
  }
}

function formatWorkflowQueueLabel(value: DocumentWorkflowState["queueCode"]) {
  switch (value) {
    case "pending_factual_review":
      return "pendiente de revision factual";
    case "pending_assignment":
      return "pendiente de asignacion";
    case "pending_learning_decision":
      return "pendiente de decision de aprendizaje";
    case "ready_for_provisional_posting":
      return "lista para posteo provisional";
    case "posted_provisional":
      return "posteada en provisional";
    case "ready_for_final_confirmation":
      return "lista para confirmacion final";
    case "posted_final":
      return "posteada en final";
    case "reopened_needs_manual_remap":
      return "reabierta para remap manual";
    default:
      return value;
  }
}

function formatClassificationStatusLabel(value: DocumentWorkflowState["classificationStatus"]) {
  switch (value) {
    case "completed":
      return "completada";
    case "failed":
      return "fallida";
    case "stale":
      return "vencida";
    case "needs_context":
      return "necesita contexto";
    default:
      return "pendiente";
  }
}

function formatSuggestionActionLabel(actionKind: AssistantSuggestionActionKind | null) {
  switch (actionKind) {
    case "run_classification":
      return "Ejecutar sugerencia";
    case "post_provisional":
      return "Postear provisional";
    case "review_context":
      return "Marcar como revisada";
    case "open_learning":
      return "Marcar recomendacion";
    default:
      return null;
  }
}

function getMissingRoleLabels(assignments: ReviewAccountRoleAssignment[]) {
  return assignments
    .filter((assignment) => assignment.isMissing)
    .map((assignment) => assignment.accountLabel ?? assignment.roleCode.replace(/_/g, " "));
}

function buildDocumentAssistantInputHash(input: DocumentAssistantSnapshotInput) {
  return computeKernelHash({
    document: {
      id: input.document.id,
      status: input.document.status,
      postingStatus: input.document.postingStatus,
      draftId: input.draft.id,
      draftStatus: input.draft.status,
      revisionNumber: input.draft.revisionNumber,
      documentRole: input.draft.documentRole,
      documentType: input.draft.documentType,
    },
    facts: {
      issuerName: input.facts.issuer_name,
      receiverName: input.facts.receiver_name,
      documentDate: input.facts.document_date,
      dueDate: input.facts.due_date,
      currencyCode: input.facts.currency_code,
      subtotal: input.facts.subtotal ?? null,
      taxAmount: input.facts.tax_amount ?? null,
      totalAmount: input.facts.total_amount ?? null,
    },
    workflow: {
      queueCode: input.workflowState.queueCode,
      classificationStatus: input.workflowState.classificationStatus,
      canRunClassification: input.workflowState.canRunClassification,
      canPostProvisional: input.workflowState.canPostProvisional,
      canConfirmFinal: input.workflowState.canConfirmFinal,
      canCreateLearningRule: input.workflowState.canCreateLearningRule,
      visibleWarnings: input.workflowState.visibleWarnings,
    },
    accounting: {
      appliedRule: {
        scope: input.derived.appliedRule.scope,
        accountId: input.derived.appliedRule.accountId,
        templateCode: input.derived.appliedRule.templateCode,
        operationCategory: input.derived.appliedRule.operationCategory,
      },
      context: {
        userFreeText: input.derived.accountingContext.userFreeText,
        businessPurposeNote: input.derived.accountingContext.businessPurposeNote,
        manualOverrideAccountId: input.derived.accountingContext.manualOverrideAccountId,
        manualOverrideConceptId: input.derived.accountingContext.manualOverrideConceptId,
        manualRoleOverrides: input.derived.accountingContext.manualRoleOverrides,
      },
      settlement: {
        operationKind: input.derived.settlementContext.operationKind,
        paymentTerms: input.derived.settlementContext.paymentTerms,
        settlementMethod: input.derived.settlementContext.settlementMethod,
        settlementStatus: input.derived.settlementContext.settlementStatus,
      },
      validation: {
        blockers: input.derived.validation.blockers,
        canPostProvisional: input.derived.validation.canPostProvisional,
        canConfirmFinal: input.derived.validation.canConfirmFinal,
      },
      accountRoleAssignments: input.accountRoleAssignments.map((assignment) => ({
        roleCode: assignment.roleCode,
        accountId: assignment.accountId,
        isMissing: assignment.isMissing,
        isProvisional: assignment.isProvisional,
      })),
    },
    classificationRun: {
      id: input.latestClassificationRun?.id ?? null,
      status: input.latestClassificationRun?.status ?? null,
      confidence: input.latestClassificationRun?.confidence ?? null,
      selectedAccountId: input.latestClassificationRun?.selectedAccountId ?? null,
      selectedOperationCategory: input.latestClassificationRun?.selectedOperationCategory ?? null,
      updatedAt: input.latestClassificationRun?.updatedAt ?? null,
    },
    learning: {
      recommendedScope: input.learningSuggestions.recommendedScope,
      optionCount: input.learningSuggestions.options.length,
    },
  });
}

function buildEvidenceHash(input: DocumentAssistantSnapshotInput) {
  return computeKernelHash({
    documentId: input.document.id,
    draftId: input.draft.id,
    revisionNumber: input.draft.revisionNumber,
    latestClassificationRunId: input.latestClassificationRun?.id ?? null,
    decisionFlags: input.workflowState.visibleWarnings,
    journalLines: input.derived.journalSuggestion.lines.map((line) => ({
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
      roleCode: line.roleCode,
      linePurpose: line.linePurpose,
    })),
    tax: {
      ready: input.derived.taxTreatment.ready,
      vatBucket: input.derived.taxTreatment.vatBucket,
      totalAmountUyu: input.derived.taxTreatment.totalAmountUyu,
    },
  });
}

function buildDeterministicSuggestions(
  input: DocumentAssistantSnapshotInput,
  inputHash: string,
): DeterministicSuggestion[] {
  const suggestions: DeterministicSuggestion[] = [];
  const missingRoleLabels = getMissingRoleLabels(input.accountRoleAssignments);

  if (
    input.workflowState.classificationStatus === "stale"
    || input.workflowState.classificationStatus === "failed"
    || input.workflowState.classificationStatus === "needs_context"
  ) {
    suggestions.push({
      suggestionType:
        input.workflowState.classificationStatus === "stale"
          ? "stale_recalculation"
          : input.workflowState.classificationStatus === "needs_context"
            ? "needs_context"
            : "classification_review",
      title:
        input.workflowState.classificationStatus === "stale"
          ? "Recalcular clasificacion vencida"
          : input.workflowState.classificationStatus === "needs_context"
            ? "Completar contexto antes de reclasificar"
            : "Reintentar clasificacion contable",
      description:
        input.workflowState.classificationStatus === "needs_context"
          ? "La ultima corrida no alcanza para cerrar el caso sin contexto adicional o sin resolver cuentas faltantes."
          : "El documento ya tiene draft abierto y conviene recalcular la clasificacion con el contexto vigente.",
      actionKind:
        input.workflowState.classificationStatus === "needs_context"
          ? "review_context"
          : "run_classification",
      actionLabel:
        input.workflowState.classificationStatus === "needs_context"
          ? "Marcar como revisada"
          : "Ejecutar sugerencia",
      payloadJson: {
        action_kind:
          input.workflowState.classificationStatus === "needs_context"
            ? "review_context"
            : "run_classification",
        latest_classification_status: input.workflowState.classificationStatus,
        reason: "document_classification_outdated",
      },
      confidence: input.latestClassificationRun?.confidence ?? input.certaintyConfidence ?? null,
      rationaleMarkdown:
        input.workflowState.classificationStatus === "needs_context"
          ? "Antes de rerunear conviene completar el contexto operativo o resolver los roles contables que faltan."
          : "La corrida previa ya no representa el estado actual del documento.",
    });
  } else if (input.workflowState.canRunClassification) {
    suggestions.push({
      suggestionType: "classification_review",
      title: "Ejecutar clasificacion con el contexto actual",
      description: "El documento ya tiene suficiente estructura para correr la clasificacion contable sobre este draft.",
      actionKind: "run_classification",
      actionLabel: "Ejecutar sugerencia",
      payloadJson: {
        action_kind: "run_classification",
        latest_classification_status: input.workflowState.classificationStatus,
        reason: "document_ready_for_classification",
      },
      confidence: input.certaintyConfidence ?? null,
      rationaleMarkdown: "La revision factual ya esta persistida y la clasificacion puede reevaluar cuentas, plantilla e IVA.",
    });
  }

  if (input.workflowState.visibleWarnings.length > 0 || missingRoleLabels.length > 0) {
    suggestions.push({
      suggestionType: "needs_context",
      title: "Resolver el contexto manual antes de cerrar",
      description:
        missingRoleLabels.length > 0
          ? `Todavia faltan roles contables por resolver: ${missingRoleLabels.slice(0, 3).join(", ")}.`
          : "Hay warnings visibles que conviene cerrar manualmente antes de continuar.",
      actionKind: "review_context",
      actionLabel: "Marcar como revisada",
      payloadJson: {
        action_kind: "review_context",
        missing_roles: missingRoleLabels,
        warning_count: input.workflowState.visibleWarnings.length,
      },
      confidence: 0.55,
      rationaleMarkdown: "El documento todavia necesita una decision humana sobre contexto o cuentas.",
    });
  }

  if (input.workflowState.canPostProvisional) {
    suggestions.push({
      suggestionType: "posting_readiness",
      title: "Postear provisional",
      description: "La revision esta suficientemente resuelta como para materializar un asiento provisional.",
      actionKind: "post_provisional",
      actionLabel: "Postear provisional",
      payloadJson: {
        action_kind: "post_provisional",
        posting_status: input.document.postingStatus,
      },
      confidence: 0.82,
      rationaleMarkdown: "El asiento y el tratamiento fiscal ya tienen base suficiente para un posteo provisional auditado.",
    });
  }

  if (input.workflowState.canCreateLearningRule && input.learningSuggestions.options.length > 0) {
    const recommendedOption = input.learningSuggestions.options.find((option) => option.recommended)
      ?? input.learningSuggestions.options[0];

    suggestions.push({
      suggestionType: "learning_scope_recommendation",
      title: "Decidir si guardar criterio reusable",
      description: recommendedOption?.reason
        ?? "Este caso ya tiene informacion suficiente para decidir si conviene aprender la regla.",
      actionKind: "open_learning",
      actionLabel: "Marcar recomendacion",
      payloadJson: {
        action_kind: "open_learning",
        recommended_scope: recommendedOption?.scope ?? input.learningSuggestions.recommendedScope,
        recommended_label: recommendedOption?.label ?? null,
      },
      confidence: 0.74,
      rationaleMarkdown: "La clasificacion ya quedo lo bastante estable como para revisar el alcance del aprendizaje.",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      suggestionType: "needs_context",
      title: "Seguir monitoreando la revision",
      description: "No veo una accion puntual para automatizar ahora mismo; conviene revisar el asiento y el IVA antes de cerrar.",
      actionKind: "review_context",
      actionLabel: "Marcar como revisada",
      payloadJson: {
        action_kind: "review_context",
        reason: "manual_followup",
        input_hash: inputHash,
      },
      confidence: 0.5,
      rationaleMarkdown: "La review esta avanzada, pero la decision final sigue siendo operativa.",
    });
  }

  return suggestions.slice(0, 4);
}

function buildDeterministicAnalysis(
  input: DocumentAssistantSnapshotInput,
): DeterministicDocumentAssistantAnalysis {
  const inputHash = buildDocumentAssistantInputHash(input);
  const evidenceHash = buildEvidenceHash(input);
  const missingRoles = getMissingRoleLabels(input.accountRoleAssignments);
  const warnings = input.workflowState.visibleWarnings.slice(0, 5);
  const confidence =
    input.latestClassificationRun?.confidence
    ?? input.certaintyConfidence
    ?? null;
  const workflowLabel = formatWorkflowQueueLabel(input.workflowState.queueCode);
  const classificationLabel = formatClassificationStatusLabel(input.workflowState.classificationStatus);
  const summaryMd =
    input.workflowState.canConfirmFinal
      ? "Veo una revision resuelta y cercana a confirmacion final."
      : input.workflowState.canPostProvisional
        ? "Veo una revision suficientemente resuelta para un posteo provisional."
        : input.workflowState.classificationStatus === "stale"
          ? "Veo una corrida contable vencida respecto al contexto actual del documento."
          : input.workflowState.classificationStatus === "failed"
            ? "Veo una clasificacion previa fallida; conviene reintentar con el contexto actual."
            : "Veo una revision abierta que todavia necesita decisiones contables o de contexto.";
  const whatISee = [
    `${formatDocumentRoleLabel(input.draft.documentRole)} ${input.draft.documentType || "documental"} en ${formatPaymentTerms(input.derived.settlementContext.paymentTerms)} con ${formatSettlementMethod(input.derived.settlementContext.settlementMethod)}.`,
    `La cola operativa actual esta ${workflowLabel} y la clasificacion se considera ${classificationLabel}.`,
    missingRoles.length > 0
      ? `Todavia faltan ${missingRoles.length} roles contables por resolver: ${missingRoles.slice(0, 3).join(", ")}.`
      : "Los roles contables requeridos por el template actual ya tienen cuenta resuelta.",
    input.latestClassificationRun
      ? `La ultima corrida de clasificacion esta ${input.latestClassificationRun.status} con confianza ${typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : "sin score"}.`
      : "Todavia no hay una corrida documentada de clasificacion contable para este draft.",
  ].filter(Boolean);
  const suggestions = buildDeterministicSuggestions(input, inputHash);
  const whatISuggest = suggestions.map((suggestion) => suggestion.description);
  const whatYouCanDecideNow = [
    input.workflowState.canRunClassification
      ? "Puedes ejecutar o reintentar la clasificacion contable con el contexto actual."
      : null,
    input.workflowState.canPostProvisional
      ? "Puedes postear provisional si quieres materializar el asiento antes de la confirmacion final."
      : null,
    input.workflowState.canConfirmFinal
      ? "Puedes confirmar final si ya no necesitas mas ajustes manuales."
      : null,
    input.workflowState.canCreateLearningRule
      ? "Puedes decidir si esta correccion merece guardarse como criterio reusable."
      : null,
    !input.workflowState.canRunClassification && warnings.length === 0 && missingRoles.length === 0
      ? "Puedes seguir revisando el asiento multi-linea y la preview fiscal antes de cerrar."
      : null,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    inputHash,
    evidenceHash,
    summaryMd,
    whatISee,
    whatISuggest,
    whatYouCanDecideNow,
    warnings,
    confidence,
    suggestions,
    provider: null,
    model: null,
    rationaleMarkdown: summaryMd,
    requestPayloadJson: {
      snapshot: {
        document_id: input.document.id,
        draft_id: input.draft.id,
        workflow_queue: input.workflowState.queueCode,
        classification_status: input.workflowState.classificationStatus,
        warning_count: warnings.length,
        missing_role_count: missingRoles.length,
      },
      deterministic_suggestions: suggestions.map((suggestion) => ({
        suggestion_type: suggestion.suggestionType,
        action_kind: suggestion.actionKind,
      })),
    },
    responsePayloadJson: {
      summary_md: summaryMd,
      what_i_see: whatISee,
      what_i_suggest: whatISuggest,
      what_you_can_decide_now: whatYouCanDecideNow,
      warnings,
      confidence,
    },
  };
}

async function maybeEnhanceNarrativeWithOpenAI(
  deterministic: DeterministicDocumentAssistantAnalysis,
  input: DocumentAssistantSnapshotInput,
) {
  if (!process.env.OPENAI_API_KEY) {
    return deterministic;
  }

  const { openAiAccountingModel } = getOpenAIModelConfig();
  const systemPrompt = [
    `Sos ${ACCOUNTING_ASSISTANT_DISPLAY_NAME}.`,
    "Tu trabajo es resumir, justificar y priorizar sugerencias consultivas sobre un documento contable dentro de Convertilabs.",
    "No inventes cuentas, reglas ni acciones nuevas.",
    "Usa solo el contexto entregado. Devuelve un resumen breve, claro y auditable en espanol.",
  ].join("\n");
  const userPrompt = JSON.stringify({
    target: {
      document_id: input.document.id,
      draft_id: input.draft.id,
      document_role: input.draft.documentRole,
      document_type: input.draft.documentType,
      workflow_queue: input.workflowState.queueCode,
      classification_status: input.workflowState.classificationStatus,
    },
    deterministic_summary: deterministic.summaryMd,
    what_i_see: deterministic.whatISee,
    what_i_suggest: deterministic.whatISuggest,
    what_you_can_decide_now: deterministic.whatYouCanDecideNow,
    warnings: deterministic.warnings,
    confidence: deterministic.confidence ?? 0.5,
    suggestions: deterministic.suggestions.map((suggestion) => ({
      type: suggestion.suggestionType,
      title: suggestion.title,
      description: suggestion.description,
      action_kind: suggestion.actionKind,
    })),
  });

  try {
    const response = await createStructuredOpenAIResponse<{
      summaryMd: string;
      whatISee: string[];
      whatISuggest: string[];
      whatYouCanDecideNow: string[];
      warnings: string[];
      confidence: number;
    }>({
      model: openAiAccountingModel,
      schemaName: "convertilabs_document_accounting_assistant",
      schema: documentAssistantNarrativeSchema,
      systemPrompt,
      userPrompt,
    });

    if (!isNarrativePayload(response.output)) {
      return deterministic;
    }

    return {
      ...deterministic,
      summaryMd: response.output.summaryMd.trim() || deterministic.summaryMd,
      whatISee: response.output.whatISee.slice(0, 4),
      whatISuggest: response.output.whatISuggest.slice(0, 4),
      whatYouCanDecideNow: response.output.whatYouCanDecideNow.slice(0, 4),
      warnings: response.output.warnings.slice(0, 5),
      confidence: response.output.confidence,
      provider: "openai",
      model: openAiAccountingModel,
      requestPayloadJson: {
        ...deterministic.requestPayloadJson,
        openai_request: {
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
        },
      },
      responsePayloadJson: {
        ...deterministic.responsePayloadJson,
        openai_response: {
          response_id: response.responseId,
          raw_text: response.rawText,
          usage: response.usage,
          raw_response: response.rawResponse,
        },
      },
      rationaleMarkdown: response.output.summaryMd.trim() || deterministic.summaryMd,
    } satisfies DeterministicDocumentAssistantAnalysis;
  } catch {
    return deterministic;
  }
}

function buildMessageContent(payload: AssistantMessageStructuredPayload) {
  return [
    payload.summaryMd,
    "",
    "Que veo:",
    ...payload.whatISee.map((entry) => `- ${entry}`),
    "",
    "Que sugiero:",
    ...payload.whatISuggest.map((entry) => `- ${entry}`),
    "",
    "Que puedes decidir ahora:",
    ...payload.whatYouCanDecideNow.map((entry) => `- ${entry}`),
  ].join("\n");
}

async function upsertThread(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    targetKind: string;
    targetId: string;
    personaCode: AssistantPersonaCode;
    actorId: string | null;
    status: string;
    currentInputHash: string | null;
    staleReason: string | null;
    lastMessageAt?: string | null;
  },
) {
  const result = await supabase
    .from("assistant_threads")
    .upsert({
      organization_id: input.organizationId,
      target_kind: input.targetKind,
      target_id: input.targetId,
      persona_code: input.personaCode,
      opened_by_profile_id: input.actorId,
      status: input.status,
      current_input_hash: input.currentInputHash,
      stale_reason: input.staleReason,
      last_message_at: input.lastMessageAt ?? null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "organization_id,target_kind,target_id,persona_code",
    })
    .select("id, organization_id, target_kind, target_id, persona_code, opened_by_profile_id, status, current_input_hash, stale_reason, last_message_at, created_at, updated_at")
    .limit(1)
    .single();

  if (result.error && isMissingSupabaseRelationError(result.error, "assistant_threads")) {
    return null;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data as AssistantThreadRow;
}

async function loadThread(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    targetKind: string;
    targetId: string;
    personaCode: AssistantPersonaCode;
  },
) {
  const result = await supabase
    .from("assistant_threads")
    .select("id, organization_id, target_kind, target_id, persona_code, opened_by_profile_id, status, current_input_hash, stale_reason, last_message_at, created_at, updated_at")
    .eq("organization_id", input.organizationId)
    .eq("target_kind", input.targetKind)
    .eq("target_id", input.targetId)
    .eq("persona_code", input.personaCode)
    .limit(1)
    .maybeSingle();

  if (result.error && isMissingSupabaseRelationError(result.error, "assistant_threads")) {
    return null;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data as AssistantThreadRow | null) ?? null;
}

async function insertAssistantMessage(
  supabase: SupabaseClient,
  input: {
    threadId: string;
    assistantRunId: string | null;
    personaCode: AssistantPersonaCode;
    contentMd: string;
    structuredPayload: AssistantMessageStructuredPayload;
  },
) {
  const result = await supabase
    .from("assistant_messages")
    .insert({
      thread_id: input.threadId,
      role: "assistant",
      persona_code: input.personaCode,
      system_actor_id: ACCOUNTING_ASSISTANT_SYSTEM_ACTOR_ID,
      assistant_run_id: input.assistantRunId,
      content_md: input.contentMd,
      structured_payload_json: input.structuredPayload,
    })
    .select("id, thread_id, role, persona_code, created_by_profile_id, system_actor_id, assistant_run_id, content_md, structured_payload_json, created_at")
    .limit(1)
    .single();

  if (result.error && isMissingSupabaseRelationError(result.error, "assistant_messages")) {
    return null;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data as AssistantMessageRow;
}

async function updateRunMessageLink(
  supabase: SupabaseClient,
  assistantRunId: string,
  messageId: string,
) {
  const result = await supabase
    .from("assistant_runs")
    .update({
      message_id: messageId,
    })
    .eq("id", assistantRunId);

  if (
    result.error
    && (
      isMissingSupabaseRelationError(result.error, "assistant_runs")
      || isMissingSupabaseColumnError(result.error, "assistant_runs", "message_id")
    )
  ) {
    return;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function insertSuggestionRows(
  supabase: SupabaseClient,
  input: {
    assistantRunId: string;
    threadId: string;
    messageId: string | null;
    actorId: string | null;
    inputHash: string;
    evidenceHash: string;
    suggestions: DeterministicSuggestion[];
  },
) {
  if (input.suggestions.length === 0) {
    return [] as AssistantSuggestionRow[];
  }

  const payloads = input.suggestions.map((suggestion) => ({
    assistant_run_id: input.assistantRunId,
    thread_id: input.threadId,
    message_id: input.messageId,
    suggestion_type: suggestion.suggestionType,
    proposed_payload_json: {
      ...suggestion.payloadJson,
      title: suggestion.title,
      description: suggestion.description,
      action_kind: suggestion.actionKind,
      action_label: suggestion.actionLabel,
    },
    input_hash: input.inputHash,
    evidence_hash: input.evidenceHash,
    confidence: suggestion.confidence,
    rationale_md: suggestion.rationaleMarkdown,
    requested_by_profile_id: input.actorId,
    resolution_status: "pending",
  }));
  const result = await supabase
    .from("assistant_suggestions")
    .insert(payloads)
    .select("id, assistant_run_id, thread_id, message_id, suggestion_type, proposed_payload_json, input_hash, evidence_hash, confidence, rationale_md, requested_by_profile_id, resolution_status, resolved_by_profile_id, resolved_at, resolution_comment, created_at");

  if (result.error && isMissingSupabaseRelationError(result.error, "assistant_suggestions")) {
    return [];
  }

  if (
    result.error
    && (
      isMissingSupabaseColumnError(result.error, "assistant_suggestions", "thread_id")
      || isMissingSupabaseColumnError(result.error, "assistant_suggestions", "message_id")
      || isMissingSupabaseColumnError(result.error, "assistant_suggestions", "input_hash")
      || isMissingSupabaseColumnError(result.error, "assistant_suggestions", "evidence_hash")
      || isMissingSupabaseColumnError(result.error, "assistant_suggestions", "confidence")
      || isMissingSupabaseColumnError(result.error, "assistant_suggestions", "rationale_md")
      || isMissingSupabaseColumnError(result.error, "assistant_suggestions", "requested_by_profile_id")
    )
  ) {
    const legacyResult = await supabase
      .from("assistant_suggestions")
      .insert(payloads.map((payload) => ({
        assistant_run_id: payload.assistant_run_id,
        suggestion_type: payload.suggestion_type,
        proposed_payload_json: payload.proposed_payload_json,
        resolution_status: payload.resolution_status,
      })))
      .select("id, assistant_run_id, suggestion_type, proposed_payload_json, resolution_status, resolved_by_profile_id, resolved_at, resolution_comment, created_at");

    if (legacyResult.error) {
      throw new Error(legacyResult.error.message);
    }

    return ((legacyResult.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
      id: String(row.id),
      assistant_run_id: String(row.assistant_run_id),
      thread_id: input.threadId,
      message_id: input.messageId,
      suggestion_type: row.suggestion_type as DocumentAssistantSuggestionType,
      proposed_payload_json: asRecord(row.proposed_payload_json),
      input_hash: input.inputHash,
      evidence_hash: input.evidenceHash,
      confidence: null,
      rationale_md: null,
      requested_by_profile_id: input.actorId,
      resolution_status: String(row.resolution_status),
      resolved_by_profile_id: asString(row.resolved_by_profile_id),
      resolved_at: asString(row.resolved_at),
      resolution_comment: asString(row.resolution_comment),
      created_at: String(row.created_at),
    }));
  }

  return ((result.data as AssistantSuggestionRow[] | null) ?? []);
}

async function insertSuggestionEvidenceRefs(
  supabase: SupabaseClient,
  input: {
    suggestions: AssistantSuggestionRow[];
    documentId: string;
    draftId: string;
    classificationRunId: string | null;
    evidenceHash: string;
  },
) {
  if (input.suggestions.length === 0) {
    return;
  }

  const rows = input.suggestions.flatMap((suggestion) => [
    {
      assistant_suggestion_id: suggestion.id,
      source_kind: "document",
      source_id: input.documentId,
      source_hash_at_read: input.evidenceHash,
    },
    {
      assistant_suggestion_id: suggestion.id,
      source_kind: "document_draft",
      source_id: input.draftId,
      source_hash_at_read: input.evidenceHash,
    },
    ...(input.classificationRunId
      ? [{
          assistant_suggestion_id: suggestion.id,
          source_kind: "document_assignment_run",
          source_id: input.classificationRunId,
          source_hash_at_read: input.evidenceHash,
        }]
      : []),
  ]);
  const result = await supabase
    .from("assistant_suggestion_evidence_refs")
    .insert(rows);

  if (result.error && isMissingSupabaseRelationError(result.error, "assistant_suggestion_evidence_refs")) {
    return;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function loadLatestMessage(supabase: SupabaseClient, threadId: string) {
  const result = await supabase
    .from("assistant_messages")
    .select("id, thread_id, role, persona_code, created_by_profile_id, system_actor_id, assistant_run_id, content_md, structured_payload_json, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error && isMissingSupabaseRelationError(result.error, "assistant_messages")) {
    return null;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data as AssistantMessageRow | null) ?? null;
}

async function loadRecentMessages(supabase: SupabaseClient, threadId: string) {
  const result = await supabase
    .from("assistant_messages")
    .select("id, thread_id, role, persona_code, created_by_profile_id, system_actor_id, assistant_run_id, content_md, structured_payload_json, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(4);

  if (result.error && isMissingSupabaseRelationError(result.error, "assistant_messages")) {
    return [] as AssistantMessageRow[];
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return ((result.data as AssistantMessageRow[] | null) ?? []);
}

async function loadSuggestions(supabase: SupabaseClient, threadId: string) {
  const result = await supabase
    .from("assistant_suggestions")
    .select("id, assistant_run_id, thread_id, message_id, suggestion_type, proposed_payload_json, input_hash, evidence_hash, confidence, rationale_md, requested_by_profile_id, resolution_status, resolved_by_profile_id, resolved_at, resolution_comment, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (result.error && isMissingSupabaseRelationError(result.error, "assistant_suggestions")) {
    return [] as AssistantSuggestionRow[];
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return ((result.data as AssistantSuggestionRow[] | null) ?? []);
}

function normalizeMessageStructuredPayload(
  value: JsonRecord | null,
  input: {
    isStale: boolean;
  },
): AssistantMessageStructuredPayload {
  const record = asRecord(value);

  return {
    summaryMd: asString(record.summaryMd) ?? "Sin analisis disponible.",
    whatISee: asStringArray(record.whatISee),
    whatISuggest: asStringArray(record.whatISuggest),
    whatYouCanDecideNow: asStringArray(record.whatYouCanDecideNow),
    warnings: asStringArray(record.warnings),
    confidence: typeof record.confidence === "number" ? record.confidence : null,
    needsRefresh: input.isStale,
  };
}

function mapSuggestionRowToView(row: AssistantSuggestionRow): DocumentAssistantSuggestionView {
  const payload = asRecord(row.proposed_payload_json);
  const actionKind = asString(payload.action_kind) as AssistantSuggestionActionKind | null;

  return {
    id: row.id,
    suggestionType: row.suggestion_type,
    title: asString(payload.title) ?? row.suggestion_type.replace(/_/g, " "),
    description: asString(payload.description) ?? "Sugerencia consultiva del Asistente Contable.",
    actionKind,
    actionLabel: asString(payload.action_label) ?? formatSuggestionActionLabel(actionKind),
    payloadJson: payload,
    confidence: typeof row.confidence === "number" ? row.confidence : null,
    rationaleMarkdown: row.rationale_md,
    resolutionStatus: row.resolution_status,
    resolvedAt: row.resolved_at,
  };
}

async function loadThreadBundle(
  supabase: SupabaseClient,
  thread: AssistantThreadRow,
  currentInputHash: string,
): Promise<DocumentAssistantRailData> {
  const [latestMessage, recentMessages, suggestions] = await Promise.all([
    loadLatestMessage(supabase, thread.id),
    loadRecentMessages(supabase, thread.id),
    loadSuggestions(supabase, thread.id),
  ]);
  const isStale =
    thread.status === "stale"
    || Boolean(thread.current_input_hash && thread.current_input_hash !== currentInputHash);
  const latestStructuredPayload = latestMessage
    ? normalizeMessageStructuredPayload(latestMessage.structured_payload_json, { isStale })
    : null;

  return {
    persona: getAssistantPersonaPresentation(thread.persona_code),
    thread: {
      id: thread.id,
      status: thread.status,
      staleReason: thread.stale_reason,
      currentInputHash: thread.current_input_hash,
      lastMessageAt: thread.last_message_at,
    },
    latestMessage: latestMessage
      ? {
          id: latestMessage.id,
          contentMd: latestMessage.content_md,
          structuredPayload: latestStructuredPayload
            ?? {
              summaryMd: latestMessage.content_md,
              whatISee: [],
              whatISuggest: [],
              whatYouCanDecideNow: [],
              warnings: [],
              confidence: null,
              needsRefresh: isStale,
            },
          createdAt: latestMessage.created_at,
        }
      : null,
    recentMessages: recentMessages.map((message) => ({
      id: message.id,
      contentMd: message.content_md,
      createdAt: message.created_at,
    })),
    suggestions: suggestions.map(mapSuggestionRowToView),
    canRefresh: isStale,
    isStale,
    currentInputHash,
  };
}

async function generateDocumentAssistantAnalysis(
  supabase: SupabaseClient,
  input: DocumentAssistantSnapshotInput,
) {
  const deterministic = buildDeterministicAnalysis(input);
  const enriched = await maybeEnhanceNarrativeWithOpenAI(deterministic, input);
  const thread = await upsertThread(supabase, {
    organizationId: input.organizationId,
    targetKind: "document",
    targetId: input.document.id,
    personaCode: DOCUMENT_REVIEWER_ASSISTANT_CODE,
    actorId: input.actorId,
    status: "open",
    currentInputHash: enriched.inputHash,
    staleReason: null,
  });

  if (!thread) {
    return null;
  }

  await supersedePendingAssistantSuggestions(supabase, {
    organizationId: input.organizationId,
    targetKind: "document",
    targetId: input.document.id,
    resolvedByProfileId: input.actorId,
    comment: "Reemplazada por un nuevo analisis del Asistente Contable.",
  });

  const assistantRunId = await recordAssistantRun(supabase, {
    organizationId: input.organizationId,
    requestedByProfileId: input.actorId,
    threadId: thread.id,
    persona: DOCUMENT_REVIEWER_ASSISTANT_CODE,
    scope: "documents",
    targetKind: "document",
    targetId: input.document.id,
    promptTemplateKey: "document_accounting_assistant",
    promptTemplateVersion: "v1",
    provider: enriched.provider,
    model: enriched.model,
    modelVersion: enriched.model,
    status: "completed",
    confidence: enriched.confidence,
    rationaleMarkdown: enriched.rationaleMarkdown,
    inputHash: enriched.inputHash,
    outputJson: {
      summary_md: enriched.summaryMd,
      suggestions: enriched.suggestions.map((suggestion) => ({
        suggestion_type: suggestion.suggestionType,
        action_kind: suggestion.actionKind,
        title: suggestion.title,
      })),
    },
    warningsJson: enriched.warnings,
    requestPayloadJson: enriched.requestPayloadJson,
    responsePayloadJson: enriched.responsePayloadJson,
    evidenceRefs: [
      {
        sourceKind: "document",
        sourceId: input.document.id,
        sourceHashAtRead: enriched.evidenceHash,
      },
      {
        sourceKind: "document_draft",
        sourceId: input.draft.id,
        sourceHashAtRead: enriched.evidenceHash,
      },
      ...(input.latestClassificationRun?.id
        ? [{
            sourceKind: "document_assignment_run",
            sourceId: input.latestClassificationRun.id,
            sourceHashAtRead: enriched.evidenceHash,
          }]
        : []),
    ],
  });
  const messagePayload: AssistantMessageStructuredPayload = {
    summaryMd: enriched.summaryMd,
    whatISee: enriched.whatISee,
    whatISuggest: enriched.whatISuggest,
    whatYouCanDecideNow: enriched.whatYouCanDecideNow,
    warnings: enriched.warnings,
    confidence: enriched.confidence,
    needsRefresh: false,
  };
  const insertedMessage = await insertAssistantMessage(supabase, {
    threadId: thread.id,
    assistantRunId,
    personaCode: DOCUMENT_REVIEWER_ASSISTANT_CODE,
    contentMd: buildMessageContent(messagePayload),
    structuredPayload: messagePayload,
  });

  if (assistantRunId && insertedMessage?.id) {
    await updateRunMessageLink(supabase, assistantRunId, insertedMessage.id);
  }

  const insertedSuggestions = assistantRunId
    ? await insertSuggestionRows(supabase, {
        assistantRunId,
        threadId: thread.id,
        messageId: insertedMessage?.id ?? null,
        actorId: input.actorId,
        inputHash: enriched.inputHash,
        evidenceHash: enriched.evidenceHash,
        suggestions: enriched.suggestions,
      })
    : [];

  await insertSuggestionEvidenceRefs(supabase, {
    suggestions: insertedSuggestions,
    documentId: input.document.id,
    draftId: input.draft.id,
    classificationRunId: input.latestClassificationRun?.id ?? null,
    evidenceHash: enriched.evidenceHash,
  });

  const lastMessageAt = insertedMessage?.created_at ?? new Date().toISOString();
  const updatedThread = await upsertThread(supabase, {
    organizationId: input.organizationId,
    targetKind: "document",
    targetId: input.document.id,
    personaCode: DOCUMENT_REVIEWER_ASSISTANT_CODE,
    actorId: input.actorId,
    status: "open",
    currentInputHash: enriched.inputHash,
    staleReason: null,
    lastMessageAt,
  });

  return updatedThread
    ? loadThreadBundle(supabase, updatedThread, enriched.inputHash)
    : null;
}

export async function markDocumentAssistantThreadStale(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
    reason: string;
  },
) {
  const result = await supabase
    .from("assistant_threads")
    .update({
      status: "stale",
      stale_reason: input.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("target_kind", "document")
    .eq("target_id", input.documentId)
    .eq("persona_code", DOCUMENT_REVIEWER_ASSISTANT_CODE);

  if (result.error && isMissingSupabaseRelationError(result.error, "assistant_threads")) {
    return;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function loadOrCreateDocumentAssistantRail(
  supabase: SupabaseClient,
  input: DocumentAssistantSnapshotInput & {
    userRole: OrganizationMemberRole;
  },
): Promise<DocumentAssistantRailData | null> {
  if (!canAccessDocumentAssistant(input.userRole)) {
    return null;
  }

  const currentInputHash = buildDocumentAssistantInputHash(input);
  const existingThread = await loadThread(supabase, {
    organizationId: input.organizationId,
    targetKind: "document",
    targetId: input.document.id,
    personaCode: DOCUMENT_REVIEWER_ASSISTANT_CODE,
  });

  if (!existingThread) {
    return generateDocumentAssistantAnalysis(supabase, input);
  }

  const latestMessage = await loadLatestMessage(supabase, existingThread.id);

  if (!latestMessage) {
    return generateDocumentAssistantAnalysis(supabase, input);
  }

  if (existingThread.current_input_hash !== currentInputHash || existingThread.status === "stale") {
    if (existingThread.status !== "stale" || existingThread.current_input_hash !== currentInputHash) {
      await markDocumentAssistantThreadStale(supabase, {
        organizationId: input.organizationId,
        documentId: input.document.id,
        reason: "document_context_changed",
      });
    }

    const refreshedThread = await loadThread(supabase, {
      organizationId: input.organizationId,
      targetKind: "document",
      targetId: input.document.id,
      personaCode: DOCUMENT_REVIEWER_ASSISTANT_CODE,
    });

    if (!refreshedThread) {
      return null;
    }

    return loadThreadBundle(supabase, refreshedThread, currentInputHash);
  }

  return loadThreadBundle(supabase, existingThread, currentInputHash);
}

export async function refreshDocumentAssistantAnalysis(
  supabase: SupabaseClient,
  input: DocumentAssistantSnapshotInput & {
    userRole: OrganizationMemberRole;
  },
) {
  if (!canAccessDocumentAssistant(input.userRole)) {
    return {
      ok: false,
      message: "Tu rol no puede actualizar el analisis del Asistente Contable.",
      rail: null,
    };
  }

  const rail = await generateDocumentAssistantAnalysis(supabase, input);

  return {
    ok: Boolean(rail),
    message: rail
      ? "Analisis del Asistente Contable actualizado."
      : "No se pudo actualizar el analisis del Asistente Contable.",
    rail,
  };
}

export async function resolveDocumentAssistantSuggestion(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    suggestionId: string;
    actorId: string | null;
    resolutionStatus: "accepted" | "rejected" | "edited";
    resolutionComment?: string | null;
  },
) {
  const result = await supabase
    .from("assistant_suggestions")
    .select("id, assistant_run_id, thread_id, message_id, suggestion_type, proposed_payload_json, input_hash, evidence_hash, confidence, rationale_md, requested_by_profile_id, resolution_status, resolved_by_profile_id, resolved_at, resolution_comment, created_at")
    .eq("id", input.suggestionId)
    .limit(1)
    .maybeSingle();

  if (result.error && isMissingSupabaseRelationError(result.error, "assistant_suggestions")) {
    return {
      ok: false,
      message: "La capa consultiva del Asistente Contable aun no esta disponible en esta base.",
      actionKind: null,
      payloadJson: {},
    };
  }

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "No encontramos la sugerencia del Asistente Contable.");
  }

  const suggestion = result.data as AssistantSuggestionRow;

  if (suggestion.resolution_status !== "pending") {
    return {
      ok: true,
      message: "La sugerencia ya estaba resuelta.",
      actionKind: asString(asRecord(suggestion.proposed_payload_json).action_kind) as AssistantSuggestionActionKind | null,
      payloadJson: asRecord(suggestion.proposed_payload_json),
    };
  }

  const updateResult = await supabase
    .from("assistant_suggestions")
    .update({
      resolution_status: input.resolutionStatus,
      resolved_by_profile_id: input.actorId,
      resolved_at: new Date().toISOString(),
      resolution_comment: input.resolutionComment ?? null,
    })
    .eq("id", suggestion.id);

  if (updateResult.error) {
    throw new Error(updateResult.error.message);
  }

  await supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorId,
      entity_type: "assistant_suggestion",
      entity_id: suggestion.id,
      action: `assistant_suggestion_${input.resolutionStatus}`,
      metadata: {
        assistant_run_id: suggestion.assistant_run_id,
        thread_id: suggestion.thread_id,
        suggestion_type: suggestion.suggestion_type,
      },
    });

  return {
    ok: true,
    message:
      input.resolutionStatus === "accepted"
        ? "Sugerencia aceptada."
        : input.resolutionStatus === "rejected"
          ? "Sugerencia rechazada."
          : "Sugerencia marcada como editada.",
    actionKind: asString(asRecord(suggestion.proposed_payload_json).action_kind) as AssistantSuggestionActionKind | null,
    payloadJson: asRecord(suggestion.proposed_payload_json),
  };
}
