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
  'Asistente IA del sistema',
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

create table if not exists public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by_profile_id uuid references public.profiles(id),
  system_actor_id text not null references public.system_actors(id),
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

create table if not exists public.assistant_suggestions (
  id uuid primary key default gen_random_uuid(),
  assistant_run_id uuid not null references public.assistant_runs(id) on delete cascade,
  suggestion_type text not null,
  proposed_payload_json jsonb not null default '{}'::jsonb,
  resolution_status text not null default 'pending',
  resolved_by_profile_id uuid references public.profiles(id),
  resolved_at timestamptz,
  resolution_comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_suggestions_run_status
  on public.assistant_suggestions (assistant_run_id, resolution_status, created_at desc);

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
