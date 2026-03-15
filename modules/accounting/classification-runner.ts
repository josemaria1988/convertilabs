import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { buildPersistableConceptLines } from "@/modules/accounting/concept-resolution";
import {
  buildAccountingDecisionLog,
  insertAIDecisionLogs,
} from "@/modules/accounting/decision-log";
import {
  upsertDocumentAccountingContext,
  upsertDocumentInvoiceIdentity,
  upsertDocumentLineItems,
} from "@/modules/accounting/repository";
import { buildDraftStepSnapshots } from "@/modules/accounting/rule-engine";
import { deriveDocumentAccountingState } from "@/modules/accounting/runtime";
import type {
  DerivedDraftArtifacts,
  DocumentAssignmentRunRecord,
} from "@/modules/accounting/types";
import { loadReviewDocumentContext } from "@/modules/documents/review-context";

type AssignmentRunRow = {
  id: string;
  organization_id: string;
  document_id: string;
  draft_id: string;
  triggered_by_user_id: string | null;
  status: "started" | "completed" | "failed" | "stale";
  request_payload_json: Record<string, unknown> | null;
  response_json: Record<string, unknown> | null;
  selected_account_id: string | null;
  selected_operation_category: string | null;
  selected_template_code: string | null;
  selected_tax_profile_code: string | null;
  confidence: number | null;
  provider_code: string | null;
  model_code: string | null;
  latency_ms: number | null;
  created_at: string;
  updated_at: string | null;
};

function mapAssignmentRun(row: AssignmentRunRow): DocumentAssignmentRunRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    documentId: row.document_id,
    draftId: row.draft_id,
    triggeredByUserId: row.triggered_by_user_id,
    status: row.status,
    requestPayload: row.request_payload_json ?? {},
    responseJson: row.response_json ?? {},
    selectedAccountId: row.selected_account_id,
    selectedOperationCategory: row.selected_operation_category,
    selectedTemplateCode: row.selected_template_code,
    selectedTaxProfileCode: row.selected_tax_profile_code,
    confidence: row.confidence,
    providerCode: row.provider_code,
    modelCode: row.model_code,
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildClassificationRequestPayload(input: {
  organizationId: string;
  documentId: string;
  draftId: string;
  operationCategory: string | null;
  facts: Record<string, unknown>;
  amountBreakdownCount: number;
  lineItemsCount: number;
  rerunAssistant: boolean;
}) {
  return {
    organization_id: input.organizationId,
    document_id: input.documentId,
    draft_id: input.draftId,
    operation_category: input.operationCategory,
    facts: input.facts,
    amount_breakdown_count: input.amountBreakdownCount,
    line_items_count: input.lineItemsCount,
    rerun_assistant: input.rerunAssistant,
  };
}

function buildClassificationResponsePayload(derived: DerivedDraftArtifacts) {
  return {
    applied_rule: {
      rule_id: derived.appliedRule.ruleId,
      scope: derived.appliedRule.scope,
      account_id: derived.appliedRule.accountId,
      account_code: derived.appliedRule.accountCode,
      account_name: derived.appliedRule.accountName,
      provenance: derived.appliedRule.provenance,
      priority: derived.appliedRule.priority,
      template_code: derived.appliedRule.templateCode,
      tax_profile_code: derived.appliedRule.taxProfileCode,
      operation_category: derived.appliedRule.operationCategory,
    },
    assistant: {
      status: derived.assistantSuggestion.status,
      confidence: derived.assistantSuggestion.confidence,
      rationale: derived.assistantSuggestion.rationale,
      review_flags: derived.assistantSuggestion.reviewFlags,
    },
    validation: derived.validation,
    journal_ready: derived.journalSuggestion.ready,
    tax_ready: derived.taxTreatment.ready,
  };
}

async function insertStartedAssignmentRun(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
    draftId: string;
    actorId: string | null;
    requestPayload: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .from("document_assignment_runs")
    .insert({
      organization_id: input.organizationId,
      document_id: input.documentId,
      draft_id: input.draftId,
      triggered_by_user_id: input.actorId,
      status: "started",
      request_payload_json: input.requestPayload,
    })
    .select(
      "id, organization_id, document_id, draft_id, triggered_by_user_id, status, request_payload_json, response_json, selected_account_id, selected_operation_category, selected_template_code, selected_tax_profile_code, confidence, provider_code, model_code, latency_ms, created_at, updated_at",
    )
    .limit(1)
    .single();

  if (error && isMissingSupabaseRelationError(error, "document_assignment_runs")) {
    return null;
  }

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo iniciar la corrida de clasificacion.");
  }

  return mapAssignmentRun(data as AssignmentRunRow);
}

async function updateAssignmentRun(
  supabase: SupabaseClient,
  runId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("document_assignment_runs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error && isMissingSupabaseRelationError(error, "document_assignment_runs")) {
    return;
  }

  if (error) {
    throw new Error(error.message);
  }
}

export async function markDocumentAssignmentRunsStale(
  supabase: SupabaseClient,
  input: {
    documentId: string;
    excludeRunId?: string | null;
  },
) {
  const query = supabase
    .from("document_assignment_runs")
    .update({
      status: "stale",
      updated_at: new Date().toISOString(),
    })
    .eq("document_id", input.documentId)
    .neq("status", "stale");

  const result = input.excludeRunId
    ? await query.neq("id", input.excludeRunId)
    : await query;

  if (result.error && isMissingSupabaseRelationError(result.error, "document_assignment_runs")) {
    return;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function loadLatestDocumentAssignmentRun(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string,
) {
  const { data, error } = await supabase
    .from("document_assignment_runs")
    .select(
      "id, organization_id, document_id, draft_id, triggered_by_user_id, status, request_payload_json, response_json, selected_account_id, selected_operation_category, selected_template_code, selected_tax_profile_code, confidence, provider_code, model_code, latency_ms, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && isMissingSupabaseRelationError(error, "document_assignment_runs")) {
    return null;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapAssignmentRun(data as AssignmentRunRow) : null;
}

export async function runDocumentClassification(input: {
  organizationId: string;
  documentId: string;
  actorId: string | null;
  rerunAssistant?: boolean;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const context = await loadReviewDocumentContext({
    supabase,
    organizationId: input.organizationId,
    documentId: input.documentId,
    actorId: input.actorId,
  });
  const requestPayload = buildClassificationRequestPayload({
    organizationId: input.organizationId,
    documentId: input.documentId,
    draftId: context.draft.id,
    operationCategory: context.operationCategory,
    facts: context.facts,
    amountBreakdownCount: context.amountBreakdown.length,
    lineItemsCount: context.lineItems.length,
    rerunAssistant: input.rerunAssistant ?? true,
  });
  const startedRun = await insertStartedAssignmentRun(supabase, {
    organizationId: input.organizationId,
    documentId: input.documentId,
    draftId: context.draft.id,
    actorId: input.actorId,
    requestPayload,
  });

  try {
    const accountingState = await deriveDocumentAccountingState({
      supabase,
      organizationId: input.organizationId,
      documentId: context.document.id,
      draftId: context.draft.id,
      actorId: input.actorId,
      documentRole: context.draft.document_role,
      documentType: context.draft.document_type,
      facts: context.facts,
      amountBreakdown: context.amountBreakdown,
      lineItems: context.lineItems,
      operationCategory: context.operationCategory,
      profile: context.profile,
      ruleSnapshot: context.ruleSnapshot,
      invoiceIdentity: context.invoiceIdentity,
      runAssistant: input.rerunAssistant ?? true,
    });
    const derived = accountingState.derived;
    const savedAt = new Date().toISOString();

    if (derived.invoiceIdentity) {
      await upsertDocumentInvoiceIdentity(supabase, {
        organization_id: context.document.organization_id,
        document_id: context.document.id,
        source_draft_id: context.draft.id,
        vendor_id: derived.vendorResolution.vendorId,
        issuer_tax_id_normalized: derived.invoiceIdentity.issuerTaxIdNormalized,
        issuer_name_normalized: derived.invoiceIdentity.issuerNameNormalized,
        document_number_normalized: derived.invoiceIdentity.documentNumberNormalized,
        document_date: derived.invoiceIdentity.documentDate,
        total_amount: derived.invoiceIdentity.totalAmount,
        currency_code: derived.invoiceIdentity.currencyCode,
        identity_strategy: derived.invoiceIdentity.identityStrategy,
        invoice_identity_key: derived.invoiceIdentity.invoiceIdentityKey,
        duplicate_status: derived.invoiceIdentity.duplicateStatus,
        duplicate_of_document_id: derived.invoiceIdentity.duplicateOfDocumentId,
        duplicate_reason: derived.invoiceIdentity.duplicateReason,
        resolution_notes: null,
      });
    }

    await upsertDocumentLineItems(supabase, {
      organizationId: context.document.organization_id,
      documentId: context.document.id,
      draftId: context.draft.id,
      lines: buildPersistableConceptLines({
        lineItems: context.lineItems,
        amountBreakdown: context.amountBreakdown,
        conceptLines: derived.conceptResolution.lines,
      }),
    });
    await upsertDocumentAccountingContext(supabase, {
      organizationId: context.document.organization_id,
      documentId: context.document.id,
      draftId: context.draft.id,
      actorId: input.actorId,
      context: derived.accountingContext,
    });
    const { error: stepsError } = await supabase
      .from("document_draft_steps")
      .upsert(
        buildDraftStepSnapshots({
          documentRole: context.draft.document_role,
          documentType: context.draft.document_type,
          operationCategory: context.operationCategory,
          facts: context.facts,
          amountBreakdown: context.amountBreakdown,
          lineItems: context.lineItems,
          derived,
          savedAt,
        }).map((step) => ({
          draft_id: context.draft.id,
          step_code: step.step_code,
          status: step.status,
          last_saved_at: step.last_saved_at,
          stale_reason: step.stale_reason,
          snapshot_json: step.snapshot_json,
        })),
        {
          onConflict: "draft_id,step_code",
        },
      );

    if (stepsError) {
      throw new Error(stepsError.message);
    }

    const { error: draftError } = await supabase
      .from("document_drafts")
      .update({
        status: derived.validation.canConfirm ? "ready_for_confirmation" : "open",
        journal_suggestion_json: derived.journalSuggestion,
        tax_treatment_json: derived.taxTreatment,
        updated_by: input.actorId,
        updated_at: savedAt,
      })
      .eq("id", context.draft.id);

    if (draftError) {
      throw new Error(draftError.message);
    }

    const { error: documentError } = await supabase
      .from("documents")
      .update({
        status: derived.validation.canConfirm ? "draft_ready" : "needs_review",
        posting_status: derived.validation.postingStatus,
        current_draft_id: context.draft.id,
        direction: context.draft.document_role,
        document_type: context.draft.document_type,
        document_date: context.facts.document_date ?? context.document.document_date,
        metadata: {
          ...(context.document.metadata ?? {}),
          last_classification_run_status: "completed",
        },
        updated_at: savedAt,
      })
      .eq("id", context.document.id);

    if (documentError) {
      throw new Error(documentError.message);
    }

    await markDocumentAssignmentRunsStale(supabase, {
      documentId: context.document.id,
      excludeRunId: startedRun?.id ?? null,
    });
    await insertAIDecisionLogs(supabase, [
      buildAccountingDecisionLog({
        organizationId: context.document.organization_id,
        documentId: context.document.id,
        providerCode: derived.assistantSuggestion.providerCode,
        modelCode: derived.assistantSuggestion.modelCode,
        derived,
      }),
    ]);

    if (startedRun?.id) {
      await updateAssignmentRun(supabase, startedRun.id, {
        status: "completed",
        response_json: buildClassificationResponsePayload(derived),
        selected_account_id: derived.appliedRule.accountId,
        selected_operation_category:
          derived.appliedRule.operationCategory ?? context.operationCategory,
        selected_template_code:
          derived.journalSuggestion.templateCode ?? derived.appliedRule.templateCode,
        selected_tax_profile_code: derived.appliedRule.taxProfileCode,
        confidence: derived.assistantSuggestion.confidence,
        provider_code: derived.assistantSuggestion.providerCode,
        model_code: derived.assistantSuggestion.modelCode,
        latency_ms: derived.assistantSuggestion.latencyMs,
      });
    }

    return {
      ok: true,
      message: derived.validation.canConfirm
        ? "Clasificacion contable actualizada y lista para revisar."
        : "Clasificacion ejecutada con warnings o bloqueos pendientes.",
      derived,
      run: startedRun
        ? {
            ...startedRun,
            status: "completed" as const,
            responseJson: buildClassificationResponsePayload(derived),
            selectedAccountId: derived.appliedRule.accountId,
            selectedOperationCategory:
              derived.appliedRule.operationCategory ?? context.operationCategory,
            selectedTemplateCode:
              derived.journalSuggestion.templateCode ?? derived.appliedRule.templateCode,
            selectedTaxProfileCode: derived.appliedRule.taxProfileCode,
            confidence: derived.assistantSuggestion.confidence,
            providerCode: derived.assistantSuggestion.providerCode,
            modelCode: derived.assistantSuggestion.modelCode,
            latencyMs: derived.assistantSuggestion.latencyMs,
          }
        : null,
    };
  } catch (error) {
    if (startedRun?.id) {
      await updateAssignmentRun(supabase, startedRun.id, {
        status: "failed",
        response_json: {
          error: error instanceof Error ? error.message : "classification_failed",
        },
      });
    }

    throw error;
  }
}
