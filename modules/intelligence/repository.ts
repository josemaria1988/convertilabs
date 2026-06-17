import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildEntityLinkPayload } from "@/modules/events";
import { buildTaskPayload } from "@/modules/operations";
import { buildOperationalSuggestionPayload } from "@/modules/intelligence/service";
import type {
  OperationalSuggestionRow,
  OperationalSuggestionStatus,
} from "@/modules/intelligence/types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTaskPriority(value: unknown) {
  return ["low", "normal", "high", "urgent"].includes(String(value))
    ? String(value) as "low" | "normal" | "high" | "urgent"
    : "normal";
}

export async function createOperationalSuggestion(
  supabase: SupabaseClient,
  input: Parameters<typeof buildOperationalSuggestionPayload>[0],
) {
  const payload = buildOperationalSuggestionPayload(input);
  const { data, error } = await supabase
    .from("operational_suggestions")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return String((data as { id: string }).id);
}

async function loadSuggestion(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    suggestionId: string;
  },
) {
  const { data, error } = await supabase
    .from("operational_suggestions")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.suggestionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Sugerencia IA no encontrada para esta organizacion.");
  }

  return data as OperationalSuggestionRow;
}

export async function reviewOperationalSuggestion(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    suggestionId: string;
    status: Extract<OperationalSuggestionStatus, "rejected" | "expired">;
    actorId: string | null;
    reviewNote?: string | null;
  },
) {
  const { error } = await supabase
    .from("operational_suggestions")
    .update({
      status: input.status,
      reviewed_by: input.actorId,
      reviewed_at: new Date().toISOString(),
      review_note: input.reviewNote ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.suggestionId);

  if (error) {
    throw new Error(error.message);
  }
}

async function materializeTaskSuggestion(
  supabase: SupabaseClient,
  suggestion: OperationalSuggestionRow,
  actorId: string | null,
) {
  const action = asRecord(suggestion.suggested_action_json);
  const payload = buildTaskPayload({
    organizationId: suggestion.organization_id,
    actorId,
    title: asString(action.title) ?? "Tarea sugerida por IA",
    description: asString(action.description) ?? suggestion.reason,
    priority: normalizeTaskPriority(action.priority),
    dueDate: asString(action.dueDate),
    partyId: asString(action.partyId),
    workUnitId: asString(action.workUnitId),
    documentId: asString(action.documentId),
    metadata: {
      source: "operational_suggestion",
      suggestion_id: suggestion.id,
      suggestion_type: suggestion.suggestion_type,
    },
  });
  const { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    entityType: "task",
    entityId: String((data as { id: string }).id),
  };
}

async function materializeEntityLinkSuggestion(
  supabase: SupabaseClient,
  suggestion: OperationalSuggestionRow,
  actorId: string | null,
) {
  const action = asRecord(suggestion.suggested_action_json);
  const sourceEntityType = asString(action.sourceEntityType);
  const sourceEntityId = asString(action.sourceEntityId);
  const targetEntityType = asString(action.targetEntityType);
  const targetEntityId = asString(action.targetEntityId);

  if (!sourceEntityType || !sourceEntityId || !targetEntityType || !targetEntityId) {
    throw new Error("La sugerencia IA no tiene entidades suficientes para crear un link.");
  }

  const payload = buildEntityLinkPayload({
    organizationId: suggestion.organization_id,
    sourceEntityType: sourceEntityType as Parameters<typeof buildEntityLinkPayload>[0]["sourceEntityType"],
    sourceEntityId,
    targetEntityType: targetEntityType as Parameters<typeof buildEntityLinkPayload>[0]["targetEntityType"],
    targetEntityId,
    relationType: (asString(action.relationType) ?? "related_to") as Parameters<typeof buildEntityLinkPayload>[0]["relationType"],
    confidence: asNumber(action.confidence) ?? suggestion.confidence,
    actorId,
    metadata: {
      source: "operational_suggestion",
      suggestion_id: suggestion.id,
      suggestion_type: suggestion.suggestion_type,
    },
  });
  const { data, error } = await supabase
    .from("entity_links")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    entityType: "entity_link",
    entityId: String((data as { id: string }).id),
  };
}

export async function acceptOperationalSuggestion(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    suggestionId: string;
    actorId: string | null;
    reviewNote?: string | null;
  },
) {
  const suggestion = await loadSuggestion(supabase, input);

  if (suggestion.status !== "pending") {
    throw new Error("Solo se pueden aceptar sugerencias pendientes.");
  }

  const result = suggestion.suggestion_type === "task_suggestion"
    ? await materializeTaskSuggestion(supabase, suggestion, input.actorId)
    : suggestion.suggestion_type === "work_unit_assignment_suggestion"
      || suggestion.suggestion_type === "party_resolution_suggestion"
      ? await materializeEntityLinkSuggestion(supabase, suggestion, input.actorId)
      : {
        entityType: "operational_suggestion",
        entityId: suggestion.id,
      };

  const { error } = await supabase
    .from("operational_suggestions")
    .update({
      status: "accepted",
      reviewed_by: input.actorId,
      reviewed_at: new Date().toISOString(),
      review_note: input.reviewNote ?? null,
      result_entity_type: result.entityType,
      result_entity_id: result.entityId,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.suggestionId);

  if (error) {
    throw new Error(error.message);
  }

  return result;
}
