import type {
  BusinessEventPayload,
  BusinessEventType,
  EntityLinkPayload,
  EntityRelationType,
  EntityType,
  EvidenceRefPayload,
  EvidenceRefType,
} from "@/modules/events/types";

function compactText(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function requiredId(value: string | null | undefined, label: string) {
  const normalized = compactText(value);

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeConfidence(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Entity link confidence must be between 0 and 1.");
  }

  return Math.round(value * 10000) / 10000;
}

export function buildBusinessEventPayload(input: {
  organizationId: string;
  eventType: BusinessEventType;
  eventDate?: string | null;
  occurredAt?: string | null;
  summary?: string | null;
  sourceEntityType?: EntityType | null;
  sourceEntityId?: string | null;
  partyId?: string | null;
  workUnitId?: string | null;
  documentId?: string | null;
  actorMemberId?: string | null;
  actorProfileId?: string | null;
  metadata?: Record<string, unknown>;
}): BusinessEventPayload {
  return {
    organization_id: input.organizationId,
    event_type: input.eventType,
    event_date: compactText(input.eventDate),
    occurred_at: compactText(input.occurredAt) ?? new Date().toISOString(),
    summary: compactText(input.summary),
    status: "recorded",
    source_entity_type: input.sourceEntityType ?? null,
    source_entity_id: input.sourceEntityId ?? null,
    party_id: input.partyId ?? null,
    work_unit_id: input.workUnitId ?? null,
    document_id: input.documentId ?? null,
    actor_member_id: input.actorMemberId ?? null,
    actor_profile_id: input.actorProfileId ?? null,
    metadata_json: input.metadata ?? {},
  };
}

export function buildEntityLinkPayload(input: {
  organizationId: string;
  sourceEntityType: EntityType;
  sourceEntityId: string;
  targetEntityType: EntityType;
  targetEntityId: string;
  relationType: EntityRelationType;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}): EntityLinkPayload {
  const sourceEntityId = requiredId(input.sourceEntityId, "Source entity id");
  const targetEntityId = requiredId(input.targetEntityId, "Target entity id");

  if (input.sourceEntityType === input.targetEntityType && sourceEntityId === targetEntityId) {
    throw new Error("Entity links cannot point an entity to itself.");
  }

  return {
    organization_id: input.organizationId,
    source_entity_type: input.sourceEntityType,
    source_entity_id: sourceEntityId,
    target_entity_type: input.targetEntityType,
    target_entity_id: targetEntityId,
    relation_type: input.relationType,
    confidence: normalizeConfidence(input.confidence),
    status: "active",
    metadata_json: input.metadata ?? {},
    created_by: input.actorId ?? null,
  };
}

export function buildEvidenceRefPayload(input: {
  organizationId: string;
  evidenceType: EvidenceRefType;
  title?: string | null;
  description?: string | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  contentHash?: string | null;
  sourceEntityType?: EntityType | null;
  sourceEntityId?: string | null;
  capturedAt?: string | null;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}): EvidenceRefPayload {
  const storageBucket = compactText(input.storageBucket);
  const storagePath = compactText(input.storagePath);
  const externalUrl = compactText(input.externalUrl);
  const sourceEntityType = input.sourceEntityType ?? null;
  const sourceEntityId = compactText(input.sourceEntityId);

  if (sourceEntityType && !sourceEntityId) {
    throw new Error("Evidence source_entity_id is required when source_entity_type is set.");
  }

  if (!storagePath && !externalUrl && !sourceEntityId) {
    throw new Error("Evidence requires a storage path, external URL or source entity.");
  }

  return {
    organization_id: input.organizationId,
    evidence_type: input.evidenceType,
    title: compactText(input.title),
    description: compactText(input.description),
    storage_bucket: storageBucket,
    storage_path: storagePath,
    external_url: externalUrl,
    content_hash: compactText(input.contentHash),
    source_entity_type: sourceEntityType,
    source_entity_id: sourceEntityId,
    captured_at: compactText(input.capturedAt),
    metadata_json: input.metadata ?? {},
    created_by: input.actorId ?? null,
  };
}

export function buildDocumentWorkUnitLinkPayload(input: {
  organizationId: string;
  documentId: string;
  workUnitId: string;
  confidence?: number | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return buildEntityLinkPayload({
    organizationId: input.organizationId,
    sourceEntityType: "document",
    sourceEntityId: input.documentId,
    targetEntityType: "work_unit",
    targetEntityId: input.workUnitId,
    relationType: "belongs_to",
    confidence: input.confidence,
    actorId: input.actorId,
    metadata: input.metadata,
  });
}
