export const BUSINESS_EVENT_TYPES = [
  "work_unit_created",
  "work_unit_started",
  "work_unit_completed",
  "purchase_document_received",
  "sales_document_issued",
  "document_received",
  "document_issued",
  "payment_made",
  "collection_received",
  "tax_obligation_due",
  "process_run_started",
  "process_run_blocked",
  "client_contacted",
  "supplier_contacted",
  "document_posted",
  "vat_run_generated",
  "administrative_decision_recorded",
  "other",
] as const;

export type BusinessEventType = (typeof BUSINESS_EVENT_TYPES)[number];

export const ENTITY_TYPES = [
  "organization",
  "profile",
  "party",
  "contact",
  "work_unit",
  "document",
  "business_event",
  "task",
  "process",
  "process_run",
  "open_item",
  "payment",
  "collection",
  "journal_entry",
  "tax_period",
  "vat_run",
  "integration_raw_record",
  "source_event",
  "evidence_ref",
  "assistant_run",
  "assistant_message",
  "audit_log",
  "other",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_RELATION_TYPES = [
  "belongs_to",
  "involves",
  "issued_by",
  "received_from",
  "assigned_to",
  "blocks",
  "generated",
  "settles",
  "evidences",
  "discusses",
  "affects",
  "derived_from",
  "supersedes",
  "related_to",
] as const;

export type EntityRelationType = (typeof ENTITY_RELATION_TYPES)[number];

export const EVIDENCE_REF_TYPES = [
  "document",
  "storage_object",
  "integration_raw_record",
  "source_event",
  "audit_log",
  "ai_decision_log",
  "assistant_run",
  "assistant_message",
  "note",
  "url",
  "external_reference",
  "journal_entry",
  "other",
] as const;

export type EvidenceRefType = (typeof EVIDENCE_REF_TYPES)[number];

export type BusinessEventPayload = {
  organization_id: string;
  event_type: BusinessEventType;
  event_date: string | null;
  occurred_at: string;
  summary: string | null;
  status: "recorded";
  source_entity_type: EntityType | null;
  source_entity_id: string | null;
  party_id: string | null;
  work_unit_id: string | null;
  document_id: string | null;
  actor_member_id: string | null;
  actor_profile_id: string | null;
  metadata_json: Record<string, unknown>;
};

export type EntityLinkPayload = {
  organization_id: string;
  source_entity_type: EntityType;
  source_entity_id: string;
  target_entity_type: EntityType;
  target_entity_id: string;
  relation_type: EntityRelationType;
  confidence: number | null;
  status: "active";
  metadata_json: Record<string, unknown>;
  created_by: string | null;
};

export type EvidenceRefPayload = {
  organization_id: string;
  evidence_type: EvidenceRefType;
  title: string | null;
  description: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  content_hash: string | null;
  source_entity_type: EntityType | null;
  source_entity_id: string | null;
  captured_at: string | null;
  metadata_json: Record<string, unknown>;
  created_by: string | null;
};
