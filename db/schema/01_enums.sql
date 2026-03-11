create type public.member_role as enum (
  'owner',
  'admin',
  'accountant',
  'reviewer',
  'operator',
  'developer',
  'viewer'
);

create type public.document_direction as enum ('purchase', 'sale', 'other');

create type public.document_status as enum (
  'uploaded',
  'queued',
  'extracting',
  'extracted',
  'classified',
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
