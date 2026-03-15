import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentIntakeOutput } from "@/modules/ai/document-intake-contract";
import type { DerivedDraftArtifacts, ResolvedAccountingRule } from "@/modules/accounting/types";
import type { TransactionFamilyResolution } from "@/modules/accounting/transaction-family-resolution";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";

export type AIDecisionSource =
  | "deterministic_rule"
  | "vendor_rule"
  | "concept_rule"
  | "assistant"
  | "manual_override"
  | "imported";

export type AICertaintyLevel = "green" | "yellow" | "red";

export type AIDecisionLogInsert = {
  organization_id: string;
  document_id: string;
  run_type: string;
  provider_code: string | null;
  model_code: string | null;
  prompt_version: string | null;
  schema_version: string | null;
  response_id: string | null;
  decision_source: AIDecisionSource;
  confidence_score: number | null;
  certainty_level: AICertaintyLevel;
  evidence_json: Record<string, unknown>;
  rationale_text: string | null;
  warnings_json: string[];
  metadata_json: Record<string, unknown>;
};

function normalizeConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

export function resolveCertaintyLevel(input: {
  confidence: number | null | undefined;
  warnings?: string[];
  blockers?: string[];
}) {
  const confidence = normalizeConfidence(input.confidence);
  const warnings = input.warnings ?? [];
  const blockers = input.blockers ?? [];

  if (blockers.length > 0 || confidence < 0.55) {
    return "red" satisfies AICertaintyLevel;
  }

  if (warnings.length > 0 || confidence < 0.85) {
    return "yellow" satisfies AICertaintyLevel;
  }

  return "green" satisfies AICertaintyLevel;
}

export function buildDocumentIntakeDecisionLog(input: {
  organizationId: string;
  documentId: string;
  providerCode: string | null;
  modelCode: string | null;
  promptVersion: string | null;
  schemaVersion: string | null;
  responseId: string | null;
  structuredOutput: DocumentIntakeOutput;
  transactionFamilyResolution: TransactionFamilyResolution;
}) {
  const confidence = Math.min(
    normalizeConfidence(input.structuredOutput.confidence_score),
    normalizeConfidence(input.transactionFamilyResolution.confidence),
  );
  const warnings = [
    ...input.structuredOutput.warnings,
    ...input.transactionFamilyResolution.warnings,
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  return {
    organization_id: input.organizationId,
    document_id: input.documentId,
    run_type: "document_intake",
    provider_code: input.providerCode,
    model_code: input.modelCode,
    prompt_version: input.promptVersion,
    schema_version: input.schemaVersion,
    response_id: input.responseId,
    decision_source:
      input.transactionFamilyResolution.source === "model_fallback"
        ? "assistant"
        : "deterministic_rule",
    confidence_score: confidence,
    certainty_level: resolveCertaintyLevel({
      confidence,
      warnings,
      blockers: input.transactionFamilyResolution.shouldReview
        ? ["organization_identity_review_required"]
        : [],
    }),
    evidence_json: {
      issuer_matches_organization: input.structuredOutput.issuer_matches_organization,
      receiver_matches_organization: input.structuredOutput.receiver_matches_organization,
      transaction_family_resolution: input.transactionFamilyResolution,
      certainty_breakdown: input.structuredOutput.certainty_breakdown_json,
    },
    rationale_text: input.structuredOutput.explanations.classification,
    warnings_json: warnings,
    metadata_json: {
      document_role: input.transactionFamilyResolution.documentRole,
      document_subtype: input.transactionFamilyResolution.documentSubtype,
    },
  } satisfies AIDecisionLogInsert;
}

export function resolveDecisionSourceFromAppliedRule(input: {
  appliedRule: ResolvedAccountingRule;
  derived: DerivedDraftArtifacts;
}) {
  if (
    input.derived.accountingContext.manualOverrideAccountId
    || input.derived.accountingContext.manualOverrideOperationCategory
  ) {
    return "manual_override" satisfies AIDecisionSource;
  }

  if (input.appliedRule.scope === "assistant") {
    return "assistant" satisfies AIDecisionSource;
  }

  if (input.appliedRule.scope === "concept_global") {
    return "concept_rule" satisfies AIDecisionSource;
  }

  if (
    input.appliedRule.scope === "vendor_concept_operation_category"
    || input.appliedRule.scope === "vendor_concept"
    || input.appliedRule.scope === "vendor_default"
  ) {
    return "vendor_rule" satisfies AIDecisionSource;
  }

  return "deterministic_rule" satisfies AIDecisionSource;
}

export function buildAccountingDecisionLog(input: {
  organizationId: string;
  documentId: string;
  providerCode: string | null;
  modelCode: string | null;
  responseId?: string | null;
  derived: DerivedDraftArtifacts;
}) {
  const decisionSource = resolveDecisionSourceFromAppliedRule({
    appliedRule: input.derived.appliedRule,
    derived: input.derived,
  });
  const normalizedConfidence =
    input.derived.assistantSuggestion.confidence
    ?? (input.derived.validation.canConfirm ? 0.9 : 0.5);
  const warnings = [
    ...input.derived.taxTreatment.warnings,
    ...input.derived.assistantSuggestion.reviewFlags,
    ...input.derived.accountingContext.blockingReasons,
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  return {
    organization_id: input.organizationId,
    document_id: input.documentId,
    run_type: "accounting_resolution",
    provider_code: input.providerCode,
    model_code: input.modelCode,
    prompt_version: null,
    schema_version: null,
    response_id: input.responseId ?? null,
    decision_source: decisionSource,
    confidence_score: normalizedConfidence,
    certainty_level: resolveCertaintyLevel({
      confidence: normalizedConfidence,
      warnings,
      blockers: input.derived.validation.blockers,
    }),
    evidence_json: {
      applied_rule: input.derived.appliedRule,
      vendor_resolution: input.derived.vendorResolution,
      concept_resolution: input.derived.conceptResolution,
      invoice_identity: input.derived.invoiceIdentity,
    },
    rationale_text:
      input.derived.assistantSuggestion.rationale
      ?? input.derived.journalSuggestion.explanation,
    warnings_json: warnings,
    metadata_json: {
      journal_ready: input.derived.journalSuggestion.ready,
      journal_balance: input.derived.journalSuggestion.isBalanced,
      rule_id: input.derived.appliedRule.ruleId,
      rule_created_at: input.derived.appliedRule.createdAt,
    },
  } satisfies AIDecisionLogInsert;
}

export async function insertAIDecisionLogs(
  supabase: SupabaseClient,
  logs: AIDecisionLogInsert[],
) {
  if (logs.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("ai_decision_logs")
    .insert(logs);

  if (error && isMissingSupabaseRelationError(error, "ai_decision_logs")) {
    return;
  }

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadDocumentAIDecisionLogs(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
    limit?: number;
  },
) {
  const { data, error } = await supabase
    .from("ai_decision_logs")
    .select(
      "id, run_type, provider_code, model_code, prompt_version, schema_version, response_id, decision_source, confidence_score, certainty_level, evidence_json, rationale_text, warnings_json, metadata_json, created_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("document_id", input.documentId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 12);

  if (error && isMissingSupabaseRelationError(error, "ai_decision_logs")) {
    return [];
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data as Array<{
    id: string;
    run_type: string;
    provider_code: string | null;
    model_code: string | null;
    prompt_version: string | null;
    schema_version: string | null;
    response_id: string | null;
    decision_source: AIDecisionSource;
    confidence_score: number | null;
    certainty_level: AICertaintyLevel;
    evidence_json: Record<string, unknown> | null;
    rationale_text: string | null;
    warnings_json: string[] | null;
    metadata_json: Record<string, unknown> | null;
    created_at: string;
  }> | null) ?? []);
}
