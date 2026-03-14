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

create index if not exists idx_org_spreadsheet_runs_org_created
  on public.organization_spreadsheet_import_runs (organization_id, created_at desc);

create index if not exists idx_org_spreadsheet_runs_org_status
  on public.organization_spreadsheet_import_runs (organization_id, status, import_type);

alter table public.organization_spreadsheet_import_runs enable row level security;

drop policy if exists "organization_spreadsheet_import_runs_select_member" on public.organization_spreadsheet_import_runs;
create policy "organization_spreadsheet_import_runs_select_member"
on public.organization_spreadsheet_import_runs
for select
using (public.is_active_member(organization_id));

drop policy if exists "organization_spreadsheet_import_runs_insert_accounting_roles" on public.organization_spreadsheet_import_runs;
create policy "organization_spreadsheet_import_runs_insert_accounting_roles"
on public.organization_spreadsheet_import_runs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "organization_spreadsheet_import_runs_update_accounting_roles" on public.organization_spreadsheet_import_runs;
create policy "organization_spreadsheet_import_runs_update_accounting_roles"
on public.organization_spreadsheet_import_runs
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);
