create table if not exists public.organization_profile_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_number integer not null,
  status public.organization_profile_status not null default 'draft',
  effective_from date not null,
  effective_to date,
  legal_entity_type text not null,
  tax_regime_code text not null,
  country_code text not null default 'UY',
  tax_id text not null,
  profile_summary text,
  profile_json jsonb not null default '{}'::jsonb,
  vat_regime text not null default 'UNKNOWN',
  dgi_group text not null default 'UNKNOWN',
  cfe_status text not null default 'UNKNOWN',
  change_reason text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (organization_id, version_number)
);

create index if not exists idx_org_profile_versions_org_effective
  on public.organization_profile_versions (organization_id, effective_from desc);

create table if not exists public.organization_rule_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_version_id uuid references public.organization_profile_versions(id) on delete set null,
  version_number integer not null,
  status public.organization_rule_snapshot_status not null default 'draft',
  scope_code text not null default 'vat_document_intake',
  effective_from date not null,
  effective_to date,
  legal_entity_type text not null,
  tax_regime_code text not null,
  country_code text not null default 'UY',
  prompt_summary text not null,
  rules_json jsonb not null default '[]'::jsonb,
  deterministic_rule_refs_json jsonb not null default '[]'::jsonb,
  vat_regime text not null default 'UNKNOWN',
  dgi_group text not null default 'UNKNOWN',
  cfe_status text not null default 'UNKNOWN',
  snapshot_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (organization_id, version_number)
);

create index if not exists idx_org_rule_snapshots_org_effective
  on public.organization_rule_snapshots (organization_id, effective_from desc);

create table if not exists public.document_processing_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  run_number integer not null,
  status public.document_processing_run_status not null default 'queued',
  provider_code text not null default 'openai',
  model_code text,
  triggered_by text not null default 'manual',
  requested_by uuid references public.profiles(id),
  organization_rule_snapshot_id uuid references public.organization_rule_snapshots(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  openai_file_id text,
  provider_response_id text,
  provider_status text,
  transport_mode text,
  store_remote boolean not null default false,
  prompt_version text,
  schema_version text,
  attempt_count integer not null default 0,
  last_polled_at timestamptz,
  failure_stage text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  provider_response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, run_number)
);

create index if not exists idx_document_processing_runs_doc_created
  on public.document_processing_runs (document_id, created_at desc);

create table if not exists public.document_field_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  processing_run_id uuid not null references public.document_processing_runs(id) on delete cascade,
  field_name text not null,
  field_value_json jsonb not null default '{}'::jsonb,
  normalized_value_json jsonb not null default '{}'::jsonb,
  source_page integer,
  source_bbox_json jsonb not null default '{}'::jsonb,
  extraction_method text,
  confidence numeric(5,4),
  created_at timestamptz not null default now()
);

create index if not exists idx_document_field_candidates_doc
  on public.document_field_candidates (document_id, field_name);

create table if not exists public.document_classification_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  processing_run_id uuid not null references public.document_processing_runs(id) on delete cascade,
  candidate_type text not null,
  candidate_role public.document_direction,
  candidate_code text,
  explanation text,
  confidence numeric(5,4),
  rank_order integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_classification_candidates_doc
  on public.document_classification_candidates (document_id, candidate_type, rank_order);

create table if not exists public.document_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  processing_run_id uuid references public.document_processing_runs(id) on delete set null,
  organization_rule_snapshot_id uuid references public.organization_rule_snapshots(id) on delete set null,
  revision_number integer not null,
  status public.document_draft_status not null default 'open',
  document_role public.document_direction not null default 'other',
  document_type text,
  operation_context_json jsonb not null default '{}'::jsonb,
  intake_context_json jsonb not null default '{}'::jsonb,
  fields_json jsonb not null default '{}'::jsonb,
  extracted_text text,
  warnings_json jsonb not null default '[]'::jsonb,
  journal_suggestion_json jsonb not null default '{}'::jsonb,
  tax_treatment_json jsonb not null default '{}'::jsonb,
  source_confidence numeric(5,4),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (document_id, revision_number)
);

create index if not exists idx_document_drafts_doc_updated
  on public.document_drafts (document_id, updated_at desc);

create table if not exists public.document_draft_steps (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  step_code text not null,
  status public.document_draft_step_status not null default 'not_started',
  last_saved_at timestamptz,
  last_confirmed_at timestamptz,
  stale_reason text,
  snapshot_json jsonb not null default '{}'::jsonb,
  unique (draft_id, step_code)
);

create table if not exists public.document_draft_autosaves (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  step_code text not null,
  payload_patch_json jsonb not null default '{}'::jsonb,
  saved_by uuid references public.profiles(id),
  saved_at timestamptz not null default now()
);

create index if not exists idx_document_draft_autosaves_draft_saved
  on public.document_draft_autosaves (draft_id, saved_at desc);

create table if not exists public.document_line_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  line_number integer not null,
  raw_concept_code text,
  raw_concept_description text,
  normalized_concept_code text,
  normalized_concept_description text,
  net_amount numeric(18,2),
  tax_rate numeric(10,4),
  tax_amount numeric(18,2),
  total_amount numeric(18,2),
  matched_concept_id uuid references public.organization_concepts(id) on delete set null,
  match_strategy text not null default 'unmatched',
  match_confidence numeric(5,4) not null default 0,
  requires_user_context boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, line_number)
);

create index if not exists idx_document_line_items_doc_draft
  on public.document_line_items (document_id, draft_id);

create table if not exists public.document_accounting_contexts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  status text not null default 'not_required',
  reason_codes text[] not null default '{}',
  user_free_text text,
  structured_context_json jsonb not null default '{}'::jsonb,
  ai_request_payload_json jsonb not null default '{}'::jsonb,
  ai_response_json jsonb not null default '{}'::jsonb,
  provider_code text,
  model_code text,
  prompt_hash text,
  request_latency_ms integer,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id)
);

create index if not exists idx_document_accounting_contexts_doc_status
  on public.document_accounting_contexts (document_id, status);

create table if not exists public.document_assignment_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  triggered_by_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'started',
  request_payload_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  selected_account_id uuid references public.chart_of_accounts(id) on delete set null,
  selected_operation_category text,
  selected_template_code text,
  selected_tax_profile_code text,
  confidence numeric(5,4),
  provider_code text,
  model_code text,
  latency_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_document_assignment_runs_doc_created
  on public.document_assignment_runs (document_id, created_at desc);

create table if not exists public.document_confirmations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  confirmation_type public.document_confirmation_type not null,
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz not null default now(),
  snapshot_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_document_confirmations_doc
  on public.document_confirmations (document_id, confirmed_at desc);

create table if not exists public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  revision_number integer not null,
  base_confirmed_draft_id uuid references public.document_drafts(id) on delete set null,
  working_draft_id uuid references public.document_drafts(id) on delete set null,
  status public.document_revision_status not null default 'open',
  opened_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  reconfirmed_by uuid references public.profiles(id),
  reconfirmed_at timestamptz,
  unique (document_id, revision_number)
);

create table if not exists public.document_invoice_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  source_draft_id uuid references public.document_drafts(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  issuer_tax_id_normalized text,
  issuer_name_normalized text,
  document_number_normalized text,
  document_date date,
  total_amount numeric(18,2),
  currency_code text,
  identity_strategy text not null default 'insufficient_data',
  invoice_identity_key text,
  duplicate_status text not null default 'clear',
  duplicate_of_document_id uuid references public.documents(id) on delete set null,
  duplicate_reason text,
  resolution_notes text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists idx_document_invoice_identities_org_key
  on public.document_invoice_identities (organization_id, invoice_identity_key);

create index if not exists idx_document_invoice_identities_org_status
  on public.document_invoice_identities (organization_id, duplicate_status);

create table if not exists public.normative_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  source_type text not null,
  base_url text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.normative_items (
  id uuid primary key default gen_random_uuid(),
  normative_document_id uuid not null references public.normative_documents(id) on delete cascade,
  item_code text,
  topic_codes_json jsonb not null default '[]'::jsonb,
  text text not null,
  summary text,
  legal_entity_type text,
  tax_regime_code text,
  tax_type public.tax_type,
  effective_from date,
  effective_to date,
  supersedes_item_id uuid references public.normative_items(id) on delete set null,
  embedding_status text not null default 'not_started',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_normative_items_document
  on public.normative_items (normative_document_id);

create table if not exists public.normative_update_runs (
  id uuid primary key default gen_random_uuid(),
  status public.normative_update_run_status not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  sources_checked_json jsonb not null default '[]'::jsonb,
  changes_detected_json jsonb not null default '[]'::jsonb,
  review_required boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.documents
  add column if not exists current_processing_run_id uuid references public.document_processing_runs(id) on delete set null,
  add column if not exists current_draft_id uuid references public.document_drafts(id) on delete set null,
  add column if not exists last_rule_snapshot_id uuid references public.organization_rule_snapshots(id) on delete set null,
  add column if not exists last_processed_at timestamptz;

create index if not exists idx_documents_current_processing_run
  on public.documents (current_processing_run_id);

