import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseRelationError,
} from "@/lib/supabase/schema-compat";
import { computeKernelHash } from "@/modules/accounting/kernel";

export const SYSTEM_AI_ASSISTANT_ID = "system_ai_assistant";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export type AssistantRunInsertInput = {
  organizationId: string;
  requestedByProfileId: string | null;
  threadId?: string | null;
  messageId?: string | null;
  persona: string;
  scope: string;
  targetKind: string;
  targetId: string;
  promptTemplateKey: string | null;
  promptTemplateVersion: string | null;
  provider: string | null;
  model: string | null;
  modelVersion: string | null;
  status: string;
  confidence: number | null;
  rationaleMarkdown: string | null;
  outputJson: JsonRecord;
  warningsJson: string[];
  inputHash?: string | null;
  requestPayloadJson?: JsonRecord;
  responsePayloadJson?: JsonRecord;
  evidenceRefs?: Array<{
    sourceKind: string;
    sourceId: string;
    snapshotRef?: string | null;
    sourceHashAtRead?: string | null;
    excerptHash?: string | null;
  }>;
  suggestion?:
    | {
        threadId?: string | null;
        messageId?: string | null;
        suggestionType: string;
        proposedPayloadJson: JsonRecord;
        inputHash?: string | null;
        evidenceHash?: string | null;
        confidence?: number | null;
        rationaleMarkdown?: string | null;
        requestedByProfileId?: string | null;
      }
    | null;
};

async function insertAssistantRunRow(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const attempt = await supabase
    .from("assistant_runs")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (
    attempt.error
    && (
      isMissingSupabaseColumnError(attempt.error, "assistant_runs", "thread_id")
      || isMissingSupabaseColumnError(attempt.error, "assistant_runs", "message_id")
    )
  ) {
    const legacyPayload = {
      ...payload,
    };
    delete legacyPayload.thread_id;
    delete legacyPayload.message_id;

    return supabase
      .from("assistant_runs")
      .insert(legacyPayload)
      .select("id")
      .limit(1)
      .single();
  }

  return attempt;
}

async function insertAssistantSuggestionRow(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const attempt = await supabase
    .from("assistant_suggestions")
    .insert(payload);

  if (
    attempt.error
    && (
      isMissingSupabaseColumnError(attempt.error, "assistant_suggestions", "thread_id")
      || isMissingSupabaseColumnError(attempt.error, "assistant_suggestions", "message_id")
      || isMissingSupabaseColumnError(attempt.error, "assistant_suggestions", "input_hash")
      || isMissingSupabaseColumnError(attempt.error, "assistant_suggestions", "evidence_hash")
      || isMissingSupabaseColumnError(attempt.error, "assistant_suggestions", "confidence")
      || isMissingSupabaseColumnError(attempt.error, "assistant_suggestions", "rationale_md")
      || isMissingSupabaseColumnError(attempt.error, "assistant_suggestions", "requested_by_profile_id")
    )
  ) {
    const legacyPayload = {
      assistant_run_id: payload.assistant_run_id,
      suggestion_type: payload.suggestion_type,
      proposed_payload_json: payload.proposed_payload_json,
      resolution_status: payload.resolution_status,
    };

    return supabase
      .from("assistant_suggestions")
      .insert(legacyPayload);
  }

  return attempt;
}

export async function supersedePendingAssistantSuggestions(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    targetKind: string;
    targetId: string;
    resolvedByProfileId: string | null;
    comment?: string | null;
  },
) {
  const pendingRunResult = await supabase
    .from("assistant_runs")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("target_kind", input.targetKind)
    .eq("target_id", input.targetId);

  if (pendingRunResult.error && isMissingSupabaseRelationError(pendingRunResult.error, "assistant_runs")) {
    return;
  }

  if (pendingRunResult.error) {
    throw new Error(pendingRunResult.error.message);
  }

  const runIds = ((pendingRunResult.data as Array<{ id: string }> | null) ?? [])
    .map((row) => row.id)
    .filter(Boolean);

  if (runIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("assistant_suggestions")
    .update({
      resolution_status: "superseded",
      resolved_by_profile_id: input.resolvedByProfileId,
      resolved_at: new Date().toISOString(),
      resolution_comment: input.comment ?? "Reemplazada por una corrida posterior.",
    })
    .in("assistant_run_id", runIds)
    .eq("resolution_status", "pending");

  if (error && isMissingSupabaseRelationError(error, "assistant_suggestions")) {
    return;
  }

  if (error) {
    throw new Error(error.message);
  }
}

export async function recordAssistantRun(
  supabase: SupabaseClient,
  input: AssistantRunInsertInput,
) {
  const inputHash = computeKernelHash({
    organization_id: input.organizationId,
    target_kind: input.targetKind,
    target_id: input.targetId,
    request_payload: input.requestPayloadJson ?? {},
    prompt_template_key: input.promptTemplateKey,
    prompt_template_version: input.promptTemplateVersion,
    provider: input.provider,
    model: input.model,
  });
  const now = new Date().toISOString();
  const payload = {
    organization_id: input.organizationId,
    requested_by_profile_id: input.requestedByProfileId,
    system_actor_id: SYSTEM_AI_ASSISTANT_ID,
    thread_id: input.threadId ?? null,
    message_id: input.messageId ?? null,
    persona: input.persona,
    scope: input.scope,
    target_kind: input.targetKind,
    target_id: input.targetId,
    input_hash: input.inputHash ?? inputHash,
    prompt_template_key: input.promptTemplateKey,
    prompt_template_version: input.promptTemplateVersion,
    provider: input.provider,
    model: input.model,
    model_version: input.modelVersion,
    status: input.status,
    confidence: input.confidence,
    rationale_markdown: input.rationaleMarkdown,
    output_json: input.outputJson,
    warnings_json: input.warningsJson,
    request_payload_json: input.requestPayloadJson ?? {},
    response_payload_json: input.responsePayloadJson ?? {},
    created_at: now,
    completed_at: input.status === "completed" || input.status === "failed" ? now : null,
    error_code:
      input.status === "failed"
        ? (asString(input.outputJson.error_code) ?? "assistant_run_failed")
        : null,
    error_message:
      input.status === "failed"
        ? (asString(input.outputJson.error_message) ?? input.rationaleMarkdown)
        : null,
  };
  const { data, error } = await insertAssistantRunRow(supabase, payload);

  if (error && isMissingSupabaseRelationError(error, "assistant_runs")) {
    return null;
  }

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo persistir la corrida del asistente.");
  }

  const assistantRunId = data.id as string;

  if ((input.evidenceRefs ?? []).length > 0) {
    const { error: evidenceError } = await supabase
      .from("assistant_run_evidence_refs")
      .insert(
        (input.evidenceRefs ?? []).map((reference) => ({
          assistant_run_id: assistantRunId,
          source_kind: reference.sourceKind,
          source_id: reference.sourceId,
          snapshot_ref: reference.snapshotRef ?? null,
          source_hash_at_read: reference.sourceHashAtRead ?? null,
          excerpt_hash: reference.excerptHash ?? null,
        })),
      );

    if (evidenceError && !isMissingSupabaseRelationError(evidenceError, "assistant_run_evidence_refs")) {
      throw new Error(evidenceError.message);
    }
  }

  if (input.suggestion) {
    const { error: suggestionError } = await insertAssistantSuggestionRow(supabase, {
      assistant_run_id: assistantRunId,
      thread_id: input.suggestion.threadId ?? input.threadId ?? null,
      message_id: input.suggestion.messageId ?? input.messageId ?? null,
      suggestion_type: input.suggestion.suggestionType,
      proposed_payload_json: input.suggestion.proposedPayloadJson,
      input_hash: input.suggestion.inputHash ?? input.inputHash ?? inputHash,
      evidence_hash: input.suggestion.evidenceHash ?? null,
      confidence: input.suggestion.confidence ?? input.confidence ?? null,
      rationale_md: input.suggestion.rationaleMarkdown ?? input.rationaleMarkdown ?? null,
      requested_by_profile_id:
        input.suggestion.requestedByProfileId
        ?? input.requestedByProfileId
        ?? null,
      resolution_status: "pending",
    });

    if (suggestionError && !isMissingSupabaseRelationError(suggestionError, "assistant_suggestions")) {
      throw new Error(suggestionError.message);
    }
  }

  return assistantRunId;
}

export async function resolveAssistantSuggestionsForTarget(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    targetKind: string;
    targetId: string;
    resolutionStatus: "accepted" | "rejected" | "edited" | "expired" | "superseded";
    resolvedByProfileId: string | null;
    resolutionComment?: string | null;
  },
) {
  const runResult = await supabase
    .from("assistant_runs")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("target_kind", input.targetKind)
    .eq("target_id", input.targetId);

  if (runResult.error && isMissingSupabaseRelationError(runResult.error, "assistant_runs")) {
    return;
  }

  if (runResult.error) {
    throw new Error(runResult.error.message);
  }

  const runIds = ((runResult.data as Array<{ id: string }> | null) ?? [])
    .map((row) => row.id)
    .filter(Boolean);

  if (runIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("assistant_suggestions")
    .update({
      resolution_status: input.resolutionStatus,
      resolved_by_profile_id: input.resolvedByProfileId,
      resolved_at: new Date().toISOString(),
      resolution_comment: input.resolutionComment ?? null,
    })
    .in("assistant_run_id", runIds)
    .eq("resolution_status", "pending");

  if (error && isMissingSupabaseRelationError(error, "assistant_suggestions")) {
    return;
  }

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadLatestAssistantRunForTarget(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    targetKind: string;
    targetId: string;
  },
) {
  const { data, error } = await supabase
    .from("assistant_runs")
    .select(
      "id, persona, scope, status, confidence, rationale_markdown, output_json, warnings_json, request_payload_json, response_payload_json, provider, model, model_version, created_at, completed_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("target_kind", input.targetKind)
    .eq("target_id", input.targetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && isMissingSupabaseRelationError(error, "assistant_runs")) {
    return null;
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id as string,
    persona: asString(data.persona),
    scope: asString(data.scope),
    status: asString(data.status),
    confidence: typeof data.confidence === "number" ? data.confidence : null,
    rationaleMarkdown: asString(data.rationale_markdown),
    outputJson: asRecord(data.output_json),
    warningsJson: Array.isArray(data.warnings_json)
      ? data.warnings_json.filter((warning): warning is string => typeof warning === "string")
      : [],
    requestPayloadJson: asRecord(data.request_payload_json),
    responsePayloadJson: asRecord(data.response_payload_json),
    provider: asString(data.provider),
    model: asString(data.model),
    modelVersion: asString(data.model_version),
    createdAt: asString(data.created_at),
    completedAt: asString(data.completed_at),
  };
}
