import type {
  InteractionStatus,
  InteractionType,
} from "@/modules/communications/types";
import type { InteractionTargetType } from "@/modules/operations";

function compactText(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function requiredText(value: string | null | undefined, label: string) {
  const normalized = compactText(value);

  if (!normalized) {
    throw new Error(`${label} es obligatorio.`);
  }

  return normalized;
}

export function canManageCommunications(role: string) {
  return ["owner", "admin", "admin_processing", "accountant", "reviewer", "operator"].includes(role);
}

export function buildInteractionPayload(input: {
  organizationId: string;
  interactionType?: InteractionType;
  occurredAt?: string | null;
  subject: string;
  summary?: string | null;
  body?: string | null;
  direction?: string | null;
  status?: InteractionStatus;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return {
    organization_id: input.organizationId,
    interaction_type: input.interactionType ?? "note",
    occurred_at: compactText(input.occurredAt) ?? new Date().toISOString(),
    subject: requiredText(input.subject, "Asunto de interaccion"),
    summary: compactText(input.summary),
    body: compactText(input.body),
    direction: compactText(input.direction),
    status: input.status ?? "recorded",
    created_by: input.actorId ?? null,
    metadata_json: input.metadata ?? {},
  };
}

export function buildInteractionParticipantPayload(input: {
  organizationId: string;
  interactionId: string;
  partyId?: string | null;
  contactId?: string | null;
  role?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return {
    organization_id: input.organizationId,
    interaction_id: input.interactionId,
    party_id: input.partyId ?? null,
    contact_id: input.contactId ?? null,
    role: compactText(input.role) ?? "participant",
    metadata_json: input.metadata ?? {},
  };
}

export function buildInteractionLinkPayload(input: {
  organizationId: string;
  interactionId: string;
  targetEntityType: InteractionTargetType;
  targetEntityId: string;
  relationType?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return {
    organization_id: input.organizationId,
    interaction_id: input.interactionId,
    target_entity_type: input.targetEntityType,
    target_entity_id: input.targetEntityId,
    relation_type: compactText(input.relationType) ?? "related_to",
    metadata_json: input.metadata ?? {},
  };
}
