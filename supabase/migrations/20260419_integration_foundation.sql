-- PR-02 integration foundation.
-- Generic persistence layer for provider integrations.
--
-- This intentionally does not call any Zeta Software endpoint. It only creates
-- the durable tables, indexes and RLS policies needed before a provider adapter
-- can safely ingest, dedupe, reconcile and clean up test data.

create extension if not exists pgcrypto;

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

alter table public.organization_integration_connections enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table public.integration_sync_cursors enable row level security;
alter table public.integration_raw_records enable row level security;
alter table public.document_source_refs enable row level security;
alter table public.integration_entity_links enable row level security;

drop policy if exists "organization_integration_connections_select_integration_roles" on public.organization_integration_connections;
create policy "organization_integration_connections_select_integration_roles"
on public.organization_integration_connections
for select
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_integration_connections_insert_integration_roles" on public.organization_integration_connections;
create policy "organization_integration_connections_insert_integration_roles"
on public.organization_integration_connections
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_integration_connections_update_integration_roles" on public.organization_integration_connections;
create policy "organization_integration_connections_update_integration_roles"
on public.organization_integration_connections
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_integration_connections_delete_integration_roles" on public.organization_integration_connections;
create policy "organization_integration_connections_delete_integration_roles"
on public.organization_integration_connections
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "integration_sync_runs_select_member" on public.integration_sync_runs;
create policy "integration_sync_runs_select_member"
on public.integration_sync_runs
for select
using (public.is_active_member(organization_id));

drop policy if exists "integration_sync_runs_insert_processing_roles" on public.integration_sync_runs;
create policy "integration_sync_runs_insert_processing_roles"
on public.integration_sync_runs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_sync_runs_update_processing_roles" on public.integration_sync_runs;
create policy "integration_sync_runs_update_processing_roles"
on public.integration_sync_runs
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_sync_cursors_select_member" on public.integration_sync_cursors;
create policy "integration_sync_cursors_select_member"
on public.integration_sync_cursors
for select
using (public.is_active_member(organization_id));

drop policy if exists "integration_sync_cursors_upsert_processing_roles" on public.integration_sync_cursors;
create policy "integration_sync_cursors_upsert_processing_roles"
on public.integration_sync_cursors
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_sync_cursors_update_processing_roles" on public.integration_sync_cursors;
create policy "integration_sync_cursors_update_processing_roles"
on public.integration_sync_cursors
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_raw_records_select_member" on public.integration_raw_records;
create policy "integration_raw_records_select_member"
on public.integration_raw_records
for select
using (public.is_active_member(organization_id));

drop policy if exists "integration_raw_records_insert_processing_roles" on public.integration_raw_records;
create policy "integration_raw_records_insert_processing_roles"
on public.integration_raw_records
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_raw_records_update_processing_roles" on public.integration_raw_records;
create policy "integration_raw_records_update_processing_roles"
on public.integration_raw_records
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "document_source_refs_select_member" on public.document_source_refs;
create policy "document_source_refs_select_member"
on public.document_source_refs
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_source_refs_insert_processing_roles" on public.document_source_refs;
create policy "document_source_refs_insert_processing_roles"
on public.document_source_refs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "document_source_refs_update_processing_roles" on public.document_source_refs;
create policy "document_source_refs_update_processing_roles"
on public.document_source_refs
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_entity_links_select_member" on public.integration_entity_links;
create policy "integration_entity_links_select_member"
on public.integration_entity_links
for select
using (public.is_active_member(organization_id));

drop policy if exists "integration_entity_links_insert_accounting_roles" on public.integration_entity_links;
create policy "integration_entity_links_insert_accounting_roles"
on public.integration_entity_links
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "integration_entity_links_update_accounting_roles" on public.integration_entity_links;
create policy "integration_entity_links_update_accounting_roles"
on public.integration_entity_links
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "integration_entity_links_delete_integration_roles" on public.integration_entity_links;
create policy "integration_entity_links_delete_integration_roles"
on public.integration_entity_links
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);
