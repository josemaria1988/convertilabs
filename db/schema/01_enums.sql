create type public.member_role as enum (
  'owner',
  'admin',
  'admin_processing',
  'accountant',
  'reviewer',
  'operator',
  'developer',
  'viewer'
);

create type public.document_direction as enum ('purchase', 'sale', 'other', 'unknown');

create type public.document_status as enum (
  'uploaded',
  'queued',
  'extracting',
  'extracted',
  'draft_ready',
  'classified',
  'classified_with_open_revision',
  'needs_review',
  'approved',
  'rejected',
  'duplicate',
  'archived',
  'uploading',
  'error'
);

create type public.document_posting_status as enum (
  'draft',
  'vat_ready',
  'posted_provisional',
  'posted_final',
  'locked'
);

create type public.suggestion_status as enum (
  'drafted',
  'needs_review',
  'ready_for_review',
  'approved',
  'rejected',
  'superseded'
);

create type public.organization_profile_status as enum (
  'draft',
  'active',
  'superseded'
);

create type public.organization_rule_snapshot_status as enum (
  'draft',
  'active',
  'superseded'
);

create type public.document_processing_run_status as enum (
  'queued',
  'processing',
  'completed',
  'error',
  'skipped'
);

create type public.document_draft_status as enum (
  'open',
  'ready_for_confirmation',
  'confirmed',
  'superseded'
);

create type public.document_draft_step_status as enum (
  'not_started',
  'draft_saved',
  'confirmed',
  'stale_after_upstream_change',
  'blocked',
  'error'
);

create type public.document_revision_status as enum (
  'open',
  'pending_reconfirmation',
  'reconfirmed',
  'superseded'
);

create type public.document_confirmation_type as enum (
  'final',
  'reconfirmation'
);

create type public.normative_update_run_status as enum (
  'queued',
  'processing',
  'completed',
  'error'
);

create type public.entry_status as enum (
  'draft',
  'reviewed',
  'posted',
  'exported',
  'void'
);

create type public.journal_posting_mode as enum (
  'provisional',
  'final'
);

create type public.tax_type as enum ('VAT', 'IRAE', 'IP');

create type public.tax_period_status as enum (
  'open',
  'review',
  'closed',
  'locked'
);

create type public.fiscal_period_status as enum (
  'open',
  'review',
  'closed',
  'locked',
  'ready_to_close',
  'soft_closed',
  'tax_locked',
  'hard_closed',
  'audit_frozen'
);

create type public.export_status as enum (
  'queued',
  'generating',
  'generated',
  'downloaded',
  'failed',
  'expired'
);

create type public.rule_scope as enum ('global', 'package', 'organization');

create type public.accounting_rule_status as enum (
  'candidate',
  'provisional',
  'approved'
);

create type public.accounting_rule_lifecycle_status as enum (
  'draft',
  'active',
  'paused',
  'superseded',
  'deleted_if_unused'
);

create type public.account_type as enum (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
  'memo'
);

create type public.normal_side as enum ('debit', 'credit');

create type public.dgi_reconciliation_source_kind as enum (
  'manual_summary',
  'imported_file',
  'future_connector'
);

create type public.dgi_reconciliation_run_status as enum (
  'draft',
  'computed',
  'reviewed',
  'closed'
);

create type public.dgi_reconciliation_difference_status as enum (
  'matched',
  'missing_in_system',
  'extra_in_system',
  'amount_mismatch',
  'tax_treatment_mismatch',
  'pending_manual_adjustment'
);

create type public.party_role_type as enum (
  'customer',
  'vendor',
  'bank',
  'institution',
  'accountant',
  'employee',
  'partner',
  'transport',
  'internal',
  'other'
);

create type public.party_identifier_type as enum (
  'rut',
  'tax_id',
  'email',
  'phone',
  'zeta_contact_code',
  'zeta_customer_code',
  'zeta_supplier_code',
  'external_code',
  'other'
);

create type public.work_unit_kind as enum (
  'job',
  'project',
  'operation',
  'department',
  'internal_cost_center',
  'service',
  'maintenance',
  'administration',
  'cost_center',
  'area'
);

create type public.work_unit_status as enum (
  'planned',
  'active',
  'paused',
  'blocked',
  'completed',
  'cancelled',
  'archived'
);

create type public.business_event_type as enum (
  'work_unit_created',
  'work_unit_started',
  'work_unit_completed',
  'purchase_document_received',
  'sales_document_issued',
  'document_received',
  'document_issued',
  'payment_made',
  'collection_received',
  'tax_obligation_due',
  'process_run_started',
  'process_run_blocked',
  'client_contacted',
  'supplier_contacted',
  'document_posted',
  'vat_run_generated',
  'administrative_decision_recorded',
  'other'
);

create type public.entity_type as enum (
  'organization',
  'profile',
  'party',
  'contact',
  'work_unit',
  'document',
  'business_event',
  'task',
  'process',
  'process_run',
  'open_item',
  'payment',
  'collection',
  'journal_entry',
  'tax_period',
  'vat_run',
  'integration_raw_record',
  'source_event',
  'evidence_ref',
  'assistant_run',
  'assistant_message',
  'audit_log',
  'other'
);

create type public.entity_relation_type as enum (
  'belongs_to',
  'involves',
  'issued_by',
  'received_from',
  'assigned_to',
  'blocks',
  'generated',
  'settles',
  'evidences',
  'discusses',
  'affects',
  'derived_from',
  'supersedes',
  'related_to'
);

create type public.evidence_ref_type as enum (
  'document',
  'storage_object',
  'integration_raw_record',
  'source_event',
  'audit_log',
  'ai_decision_log',
  'assistant_run',
  'assistant_message',
  'note',
  'url',
  'external_reference',
  'journal_entry',
  'other'
);
