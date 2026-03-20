import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import {
  formatOperationKindLabel,
  formatPaymentTermsLabel,
  formatPostingStatusLabel,
  formatPostingTemplateCodeLabel,
  formatRuleScopeLabel,
  formatSettlementEvidenceSourceLabel,
  formatSettlementMethodLabel,
  formatSettlementStatusLabel,
} from "@/modules/presentation/labels";
import { buildPersistableConceptLines } from "@/modules/accounting/concept-resolution";
import {
  buildAccountingDecisionLog,
  insertAIDecisionLogs,
} from "@/modules/accounting/decision-log";
import {
  recordAssistantRun,
  supersedePendingAssistantSuggestions,
} from "@/modules/assistant/runs";
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

function formatAssistantStatusLabel(value: string) {
  switch (value) {
    case "not_requested":
      return "No solicitada";
    case "completed":
      return "Completada";
    case "failed":
      return "Fallida";
    default:
      return value.replace(/_/g, " ");
  }
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
    resumen: {
      organizacion: input.organizationId,
      documento: input.documentId,
      borrador: input.draftId,
      categoria_operativa: input.operationCategory ?? "Sin definir",
      cantidad_componentes_monto: input.amountBreakdownCount,
      cantidad_lineas: input.lineItemsCount,
      reejecutar_ia: input.rerunAssistant ? "Si" : "No",
    },
  };
}

function buildClassificationResponsePayload(derived: DerivedDraftArtifacts) {
  return {
    settlement: {
      operation_kind: derived.settlementContext.operationKind,
      operation_kind_label: formatOperationKindLabel(derived.settlementContext.operationKind),
      payment_terms: derived.settlementContext.paymentTerms,
      payment_terms_label: formatPaymentTermsLabel(derived.settlementContext.paymentTerms),
      settlement_method: derived.settlementContext.settlementMethod,
      settlement_method_label: formatSettlementMethodLabel(derived.settlementContext.settlementMethod),
      settlement_status: derived.settlementContext.settlementStatus,
      settlement_status_label: formatSettlementStatusLabel(derived.settlementContext.settlementStatus),
      settlement_evidence_source: derived.settlementContext.settlementEvidenceSource,
      settlement_evidence_source_label: formatSettlementEvidenceSourceLabel(
        derived.settlementContext.settlementEvidenceSource,
      ),
      requires_followup_settlement: derived.settlementContext.requiresFollowupSettlement,
      blockers: derived.settlementContext.blockers,
      warnings: derived.settlementContext.warnings,
      resumen: {
        operacion: formatOperationKindLabel(derived.settlementContext.operationKind),
        condicion: formatPaymentTermsLabel(derived.settlementContext.paymentTerms),
        medio_cobro_pago: formatSettlementMethodLabel(derived.settlementContext.settlementMethod),
        estado: formatSettlementStatusLabel(derived.settlementContext.settlementStatus),
        fuente_evidencia: formatSettlementEvidenceSourceLabel(
          derived.settlementContext.settlementEvidenceSource,
        ),
      },
    },
    applied_rule: {
      rule_id: derived.appliedRule.ruleId,
      scope: derived.appliedRule.scope,
      scope_label: formatRuleScopeLabel(derived.appliedRule.scope),
      account_id: derived.appliedRule.accountId,
      account_code: derived.appliedRule.accountCode,
      account_name: derived.appliedRule.accountName,
      account_label:
        derived.appliedRule.accountCode && derived.appliedRule.accountName
          ? `${derived.appliedRule.accountCode} - ${derived.appliedRule.accountName}`
          : "Sin cuenta asignada",
      provenance: derived.appliedRule.provenance,
      priority: derived.appliedRule.priority,
      template_code: derived.appliedRule.templateCode,
      template_code_label: formatPostingTemplateCodeLabel(derived.appliedRule.templateCode),
      tax_profile_code: derived.appliedRule.taxProfileCode,
      operation_category: derived.appliedRule.operationCategory,
    },
    assistant: {
      status: derived.assistantSuggestion.status,
      status_label: formatAssistantStatusLabel(derived.assistantSuggestion.status),
      confidence: derived.assistantSuggestion.confidence,
      rationale: derived.assistantSuggestion.rationale,
      review_flags: derived.assistantSuggestion.reviewFlags,
      resumen: {
        estado: formatAssistantStatusLabel(derived.assistantSuggestion.status),
        confianza:
          derived.assistantSuggestion.confidence !== null
            ? `${Math.round(derived.assistantSuggestion.confidence * 100)}%`
            : "Sin dato",
        bloquear_confirmacion: derived.assistantSuggestion.shouldBlockConfirmation ? "Si" : "No",
      },
    },
    validation: derived.validation,
    validation_labels: {
      puede_confirmar: derived.validation.canConfirm ? "Si" : "No",
      puede_postear_provisional: derived.validation.canPostProvisional ? "Si" : "No",
      puede_confirmar_final: derived.validation.canConfirmFinal ? "Si" : "No",
      estado_posteo: formatPostingStatusLabel(derived.validation.postingStatus),
    },
    journal_ready: derived.journalSuggestion.ready,
    tax_ready: derived.taxTreatment.ready,
    generated_preview_lines: derived.journalSuggestion.lines,
    resumen: {
      plantilla_contable: formatPostingTemplateCodeLabel(
        derived.journalSuggestion.templateCode ?? derived.appliedRule.templateCode,
      ),
      cuenta_principal:
        derived.appliedRule.accountCode && derived.appliedRule.accountName
          ? `${derived.appliedRule.accountCode} - ${derived.appliedRule.accountName}`
          : "Sin cuenta principal",
      estado_asiento: derived.journalSuggestion.ready ? "Listo para revisar" : "Incompleto",
      estado_fiscal: derived.taxTreatment.ready ? "Listo para revisar" : "Pendiente",
    },
  };
}

function buildAssistantRunOutput(derived: DerivedDraftArtifacts) {
  if (derived.assistantSuggestion.status === "completed" && derived.assistantSuggestion.output) {
    return {
      output: derived.assistantSuggestion.output,
      summary: {
        status: derived.assistantSuggestion.status,
        confidence: derived.assistantSuggestion.confidence,
        rationale: derived.assistantSuggestion.rationale,
        review_flags: derived.assistantSuggestion.reviewFlags,
      },
    } satisfies Record<string, unknown>;
  }

  return {
    error_code: "assistant_run_failed",
    error_message:
      derived.assistantSuggestion.rationale
      ?? "La corrida del asistente no devolvio una sugerencia utilizable.",
    summary: {
      status: derived.assistantSuggestion.status,
      confidence: derived.assistantSuggestion.confidence,
      review_flags: derived.assistantSuggestion.reviewFlags,
    },
  } satisfies Record<string, unknown>;
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
      intakeContext: context.draft.intake_context_json,
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

    if (derived.assistantSuggestion.status !== "not_requested") {
      await supersedePendingAssistantSuggestions(supabase, {
        organizationId: context.document.organization_id,
        targetKind: "document",
        targetId: context.document.id,
        resolvedByProfileId: input.actorId,
        comment: "Reemplazada por una nueva corrida de clasificacion.",
      });
      await recordAssistantRun(supabase, {
        organizationId: context.document.organization_id,
        requestedByProfileId: input.actorId,
        persona: "document_reviewer_assistant",
        scope: "documents",
        targetKind: "document",
        targetId: context.document.id,
        promptTemplateKey: "accounting_assistant",
        promptTemplateVersion: "v1",
        provider: derived.assistantSuggestion.providerCode,
        model: derived.assistantSuggestion.modelCode,
        modelVersion: derived.assistantSuggestion.modelCode,
        status:
          derived.assistantSuggestion.status === "completed"
            ? "completed"
            : "failed",
        confidence: derived.assistantSuggestion.confidence,
        rationaleMarkdown: derived.assistantSuggestion.rationale,
        inputHash: derived.assistantSuggestion.promptHash,
        outputJson: buildAssistantRunOutput(derived),
        warningsJson: derived.assistantSuggestion.reviewFlags,
        requestPayloadJson: derived.assistantSuggestion.requestPayload,
        responsePayloadJson: derived.assistantSuggestion.responsePayload,
        evidenceRefs: [
          {
            sourceKind: "document",
            sourceId: context.document.id,
          },
          {
            sourceKind: "document_draft",
            sourceId: context.draft.id,
          },
        ],
        suggestion: derived.assistantSuggestion.output
          ? {
              suggestionType: "document_accounting_resolution",
              proposedPayloadJson: {
                suggested_concept_id: derived.assistantSuggestion.output.suggestedConceptId,
                suggested_account_id: derived.assistantSuggestion.output.suggestedAccountId,
                suggested_operation_category:
                  derived.assistantSuggestion.output.suggestedOperationCategory,
                linked_operation_type: derived.assistantSuggestion.output.linkedOperationType,
                should_block_confirmation:
                  derived.assistantSuggestion.output.shouldBlockConfirmation,
              },
            }
          : null,
      });
    }

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
