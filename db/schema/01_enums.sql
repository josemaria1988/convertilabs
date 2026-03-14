create type public.member_role as enum (
  'owner',
  'admin',
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

create type public.tax_type as enum ('VAT', 'IRAE', 'IP');

create type public.tax_period_status as enum (
  'open',
  'review',
  'closed',
  'locked'
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

create type public.account_type as enum (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
  'memo'
);

create type public.normal_side as enum ('debit', 'credit');
