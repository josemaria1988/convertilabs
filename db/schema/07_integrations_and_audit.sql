create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  export_type text not null,
  export_scope text not null default 'vat_period',
  target_system text not null,
  target_id uuid,
  status public.export_status not null default 'queued',
  storage_bucket text not null default 'exports-private',
  storage_path text,
  artifact_filename text,
  artifact_mime_type text,
  payload_json jsonb not null default '{}'::jsonb,
  checksum text,
  failure_message text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  downloaded_at timestamptz,
  expires_at timestamptz
);

create table if not exists public.organization_dgi_form_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  form_code text not null,
  line_code text not null,
  metric_key text not null,
  label text not null,
  calculation_mode text not null default 'direct_metric',
  configuration_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_dgi_form_mappings_org_form
  on public.organization_dgi_form_mappings (organization_id, form_code, is_active, version desc);

create table if not exists public.vat_form_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vat_run_id uuid not null references public.vat_runs(id) on delete cascade,
  export_id uuid references public.exports(id) on delete set null,
  form_code text not null,
  lines_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_vat_form_exports_org_run
  on public.vat_form_exports (organization_id, vat_run_id, created_at desc);

create table if not exists public.organization_spreadsheet_import_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid references public.documents(id) on delete set null,
  file_name text not null,
  file_kind text not null default 'unknown',
  import_type text not null default 'unsupported',
  run_mode text not null default 'interactive',
  status text not null default 'preview_ready',
  provider_code text,
  model_code text,
  prompt_version text,
  schema_version text,
  batch_id text,
  response_id text,
  estimated_cost_usd numeric(12,6),
  warnings_json jsonb not null default '[]'::jsonb,
  preview_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  detected_mapping_json jsonb not null default '{}'::jsonb,
  status_events_json jsonb not null default '[]'::jsonb,
  retry_count integer not null default 0,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_spreadsheet_import_runs
  add column if not exists ai_parse_status text,
  add column if not exists ai_parse_payload jsonb not null default '{}'::jsonb,
  add column if not exists normalized_payload jsonb not null default '{}'::jsonb,
  add column if not exists error_report jsonb not null default '{}'::jsonb;

create index if not exists idx_org_spreadsheet_runs_org_created
  on public.organization_spreadsheet_import_runs (organization_id, created_at desc);

create index if not exists idx_org_spreadsheet_runs_org_status
  on public.organization_spreadsheet_import_runs (organization_id, status, import_type);

insert into storage.buckets (
  id,
  name,
  public
)
values
  ('exports-private', 'exports-private', false),
  ('normative-private', 'normative-private', false)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  api_client_id uuid not null references public.api_clients(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  endpoint_url text not null,
  secret_hash text not null,
  events text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  mode text not null default 'read_only',
  status text not null default 'configured',
  test_mode boolean not null default true,
  config_json jsonb not null default '{}'::jsonb,
  encrypted_credentials text,
  credentials_fingerprint text,
  credentials_last_rotated_at timestamptz,
  last_connection_test_at timestamptz,
  last_connection_test_ok boolean,
  last_error text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists idx_integration_connections_org_provider_status
  on public.organization_integration_connections (organization_id, provider, status);

create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.organization_integration_connections(id) on delete set null,
  provider text not null,
  stream text not null,
  run_kind text not null default 'manual',
  status text not null default 'queued',
  test_mode boolean not null default true,
  test_run_key text,
  initiated_by_user_id uuid references public.profiles(id),
  started_at timestamptz,
  finished_at timestamptz,
  records_seen integer not null default 0,
  records_upserted integer not null default 0,
  records_skipped integer not null default 0,
  records_failed integer not null default 0,
  cursor_from text,
  cursor_to text,
  input_json jsonb not null default '{}'::jsonb,
  summary_json jsonb not null default '{}'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  cleanup_status text not null default 'not_required',
  cleanup_required_by timestamptz,
  cleanup_verified_at timestamptz,
  cleanup_verified_by_user_id uuid references public.profiles(id),
  cleanup_evidence_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integration_sync_runs_org_provider_stream_created
  on public.integration_sync_runs (organization_id, provider, stream, created_at desc);

create index if not exists idx_integration_sync_runs_org_status
  on public.integration_sync_runs (organization_id, status, created_at desc);

create table if not exists public.integration_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.organization_integration_connections(id) on delete cascade,
  provider text not null,
  stream text not null,
  cursor_key text not null,
  cursor_value text,
  cursor_json jsonb not null default '{}'::jsonb,
  last_success_run_id uuid references public.integration_sync_runs(id) on delete set null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, stream, cursor_key)
);

create index if not exists idx_integration_sync_cursors_org_provider_stream
  on public.integration_sync_cursors (organization_id, provider, stream, cursor_key);

create table if not exists public.integration_raw_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.organization_integration_connections(id) on delete set null,
  provider text not null,
  stream text not null,
  entity_type text not null,
  external_key text not null,
  external_version_key text,
  payload_json jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_sync_run_id uuid references public.integration_sync_runs(id) on delete set null,
  test_mode boolean not null default false,
  test_run_key text,
  document_date date,
  currency_code text,
  source_exchange_rate numeric(18,8),
  source_exchange_rate_date date,
  source_exchange_rate_kind text,
  source_total_amount numeric(18,2),
  source_net_amount numeric(18,2),
  source_tax_amount numeric(18,2),
  source_monetary_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, entity_type, external_key)
);

create index if not exists idx_integration_raw_records_org_stream_seen
  on public.integration_raw_records (organization_id, provider, stream, last_seen_at desc);

create index if not exists idx_integration_raw_records_payload_hash
  on public.integration_raw_records (organization_id, provider, payload_hash);

create table if not exists public.document_source_refs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  provider text not null,
  source_kind text not null,
  raw_record_id uuid references public.integration_raw_records(id) on delete set null,
  sync_run_id uuid references public.integration_sync_runs(id) on delete set null,
  external_key text not null,
  external_version_key text,
  payload_hash_at_materialization text,
  current_payload_hash text,
  drift_status text not null default 'none',
  factual_trust_mode text not null default 'external_deterministic',
  source_pdf_url text,
  source_pdf_url_expires_at timestamptz,
  bandeja_compatibility_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, source_kind, external_key)
);

create index if not exists idx_document_source_refs_document
  on public.document_source_refs (document_id, provider, source_kind);

create index if not exists idx_document_source_refs_raw_record
  on public.document_source_refs (raw_record_id);

create table if not exists public.integration_entity_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  external_entity_type text not null,
  external_key text not null,
  local_entity_type text not null,
  local_entity_id uuid not null,
  match_method text not null,
  confidence numeric(5,4),
  status text not null default 'active',
  created_by_run_id uuid references public.integration_sync_runs(id) on delete set null,
  reviewed_by_user_id uuid references public.profiles(id),
  reviewed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_entity_type, external_key)
);

create index if not exists idx_integration_entity_links_external
  on public.integration_entity_links (organization_id, provider, external_entity_type, external_key);

create index if not exists idx_integration_entity_links_local
  on public.integration_entity_links (organization_id, provider, local_entity_type, local_entity_id);

create table if not exists public.organization_cfe_email_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_label text not null default 'Casilla principal de eFacturas',
  mailbox_email text not null,
  mailbox_email_normalized text not null,
  inbound_address text not null,
  ingestion_mode text not null default 'forwarding_alias',
  status text not null default 'pending_forwarding',
  is_active boolean not null default true,
  last_inbound_email_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (mailbox_email_normalized),
  unique (inbound_address)
);

create index if not exists idx_org_cfe_email_connections_org_user
  on public.organization_cfe_email_connections (organization_id, user_id);

create index if not exists idx_org_cfe_email_connections_org_active
  on public.organization_cfe_email_connections (organization_id, is_active, updated_at desc);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_org_created
  on public.audit_log (organization_id, created_at desc);

create table if not exists public.system_actors (
  id text primary key,
  display_name text not null,
  actor_kind text not null default 'ai_assistant',
  is_active boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.system_actors (
  id,
  display_name,
  actor_kind,
  is_active,
  metadata_json
)
values (
  'system_ai_assistant',
  'Asistente Contable',
  'ai_assistant',
  true,
  jsonb_build_object(
    'personas',
    jsonb_build_array(
      'document_reviewer_assistant',
      'close_assistant',
      'tax_assistant',
      'audit_assistant'
    )
  )
)
on conflict (id) do update
set
  display_name = excluded.display_name,
  actor_kind = excluded.actor_kind,
  is_active = excluded.is_active,
  metadata_json = excluded.metadata_json,
  updated_at = now();

create table if not exists public.assistant_personas (
  code text primary key,
  display_name text not null,
  scope text not null,
  system_actor_id text not null references public.system_actors(id),
  avatar_asset_path text,
  tone text,
  specialty_md text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.assistant_personas (
  code,
  display_name,
  scope,
  system_actor_id,
  avatar_asset_path,
  tone,
  specialty_md,
  is_active
)
values
  (
    'document_reviewer_assistant',
    'Asistente Contable',
    'documents',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Revision documental y propuestas contables dentro del workflow de documentos.',
    true
  ),
  (
    'tax_assistant',
    'Asistente Contable',
    'tax',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Asistencia fiscal y trazabilidad sobre IVA, validaciones y anomalias.',
    true
  ),
  (
    'close_assistant',
    'Asistente Contable',
    'close',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Asistencia sobre cierre contable, checks y bloqueos operativos.',
    true
  ),
  (
    'audit_assistant',
    'Asistente Contable',
    'audit',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Asistencia sobre imports, evidencia y resoluciones auditables.',
    true
  )
on conflict (code) do update
set
  display_name = excluded.display_name,
  scope = excluded.scope,
  system_actor_id = excluded.system_actor_id,
  avatar_asset_path = excluded.avatar_asset_path,
  tone = excluded.tone,
  specialty_md = excluded.specialty_md,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  persona_code text not null references public.assistant_personas(code),
  opened_by_profile_id uuid references public.profiles(id),
  status text not null default 'open',
  current_input_hash text,
  stale_reason text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, target_kind, target_id, persona_code)
);

create index if not exists idx_assistant_threads_org_target
  on public.assistant_threads (organization_id, target_kind, target_id, updated_at desc);

create table if not exists public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by_profile_id uuid references public.profiles(id),
  system_actor_id text not null references public.system_actors(id),
  thread_id uuid references public.assistant_threads(id) on delete set null,
  message_id uuid,
  persona text not null,
  scope text not null,
  target_kind text not null,
  target_id text not null,
  input_hash text,
  prompt_template_key text,
  prompt_template_version text,
  provider text,
  model text,
  model_version text,
  status text not null default 'completed',
  confidence numeric(5,4),
  rationale_markdown text,
  output_json jsonb not null default '{}'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  request_payload_json jsonb not null default '{}'::jsonb,
  response_payload_json jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_assistant_runs_org_target_created
  on public.assistant_runs (organization_id, target_kind, target_id, created_at desc);

create index if not exists idx_assistant_runs_org_scope_created
  on public.assistant_runs (organization_id, scope, created_at desc);

create index if not exists idx_assistant_runs_thread_created
  on public.assistant_runs (thread_id, created_at desc);

create table if not exists public.assistant_run_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  assistant_run_id uuid not null references public.assistant_runs(id) on delete cascade,
  source_kind text not null,
  source_id text not null,
  snapshot_ref text,
  source_hash_at_read text,
  excerpt_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_run_evidence_refs_run
  on public.assistant_run_evidence_refs (assistant_run_id, source_kind);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  role text not null,
  persona_code text references public.assistant_personas(code),
  created_by_profile_id uuid references public.profiles(id),
  system_actor_id text references public.system_actors(id),
  assistant_run_id uuid references public.assistant_runs(id) on delete set null,
  content_md text not null,
  structured_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_messages_thread_created
  on public.assistant_messages (thread_id, created_at desc);

create table if not exists public.assistant_suggestions (
  id uuid primary key default gen_random_uuid(),
  assistant_run_id uuid not null references public.assistant_runs(id) on delete cascade,
  thread_id uuid references public.assistant_threads(id) on delete set null,
  message_id uuid references public.assistant_messages(id) on delete set null,
  suggestion_type text not null,
  proposed_payload_json jsonb not null default '{}'::jsonb,
  input_hash text,
  evidence_hash text,
  confidence numeric(5,4),
  rationale_md text,
  requested_by_profile_id uuid references public.profiles(id),
  resolution_status text not null default 'pending',
  resolved_by_profile_id uuid references public.profiles(id),
  resolved_at timestamptz,
  resolution_comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_suggestions_run_status
  on public.assistant_suggestions (assistant_run_id, resolution_status, created_at desc);

create index if not exists idx_assistant_suggestions_thread_status
  on public.assistant_suggestions (thread_id, resolution_status, created_at desc);

create table if not exists public.assistant_suggestion_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  assistant_suggestion_id uuid not null references public.assistant_suggestions(id) on delete cascade,
  source_kind text not null,
  source_id text not null,
  snapshot_ref text,
  source_hash_at_read text,
  excerpt_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_suggestion_evidence_refs_suggestion
  on public.assistant_suggestion_evidence_refs (assistant_suggestion_id, source_kind);

create table if not exists public.ai_decision_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  run_type text not null,
  provider_code text,
  model_code text,
  prompt_version text,
  schema_version text,
  response_id text,
  decision_source text not null,
  confidence_score numeric(5,4),
  certainty_level text not null default 'yellow',
  evidence_json jsonb not null default '{}'::jsonb,
  rationale_text text,
  warnings_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_decision_logs_org_doc_created
  on public.ai_decision_logs (organization_id, document_id, created_at desc);
