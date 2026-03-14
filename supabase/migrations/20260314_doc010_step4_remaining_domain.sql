alter table public.documents
  add column if not exists source_type text not null default 'manual_upload',
  add column if not exists source_message_id text,
  add column if not exists source_attachment_hash text,
  add column if not exists source_reference text;

create index if not exists idx_documents_org_source_type
  on public.documents (organization_id, source_type, created_at desc);

create index if not exists idx_documents_org_source_message
  on public.documents (organization_id, source_message_id)
  where source_message_id is not null;

create index if not exists idx_documents_org_source_attachment
  on public.documents (organization_id, source_attachment_hash)
  where source_attachment_hash is not null;

alter table public.vat_runs
  add column if not exists import_vat numeric(18,2) not null default 0,
  add column if not exists import_vat_advance numeric(18,2) not null default 0;

create table if not exists public.organization_import_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference_code text,
  dua_number text,
  dua_year text,
  customs_broker_name text,
  supplier_name text,
  supplier_tax_id text,
  currency_code text,
  operation_date date,
  payment_date date,
  status text not null default 'draft',
  warnings_json jsonb not null default '[]'::jsonb,
  raw_summary_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_import_operations_org_created
  on public.organization_import_operations (organization_id, created_at desc);

create index if not exists idx_import_operations_org_status
  on public.organization_import_operations (organization_id, status, operation_date);

create table if not exists public.organization_import_operation_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_operation_id uuid not null references public.organization_import_operations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  document_type text not null default 'unknown',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, import_operation_id, document_id)
);

create index if not exists idx_import_operation_documents_org_operation
  on public.organization_import_operation_documents (organization_id, import_operation_id, created_at desc);

create table if not exists public.organization_import_operation_taxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_operation_id uuid not null references public.organization_import_operations(id) on delete cascade,
  tax_code text,
  tax_label text not null,
  external_tax_code text,
  amount numeric(18,2) not null default 0,
  currency_code text not null default 'USD',
  is_creditable_vat boolean not null default false,
  is_vat_advance boolean not null default false,
  is_other_tax boolean not null default true,
  source_document_id uuid references public.documents(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_operation_taxes_org_operation
  on public.organization_import_operation_taxes (organization_id, import_operation_id, created_at desc);

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

alter table public.organization_import_operations enable row level security;
alter table public.organization_import_operation_documents enable row level security;
alter table public.organization_import_operation_taxes enable row level security;
alter table public.organization_dgi_form_mappings enable row level security;
alter table public.vat_form_exports enable row level security;

drop policy if exists "organization_import_operations_select_member" on public.organization_import_operations;
create policy "organization_import_operations_select_member"
on public.organization_import_operations
for select
using (public.is_active_member(organization_id));

drop policy if exists "organization_import_operations_insert_accounting_roles" on public.organization_import_operations;
create policy "organization_import_operations_insert_accounting_roles"
on public.organization_import_operations
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

drop policy if exists "organization_import_operations_update_accounting_roles" on public.organization_import_operations;
create policy "organization_import_operations_update_accounting_roles"
on public.organization_import_operations
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

drop policy if exists "organization_import_operation_documents_select_member" on public.organization_import_operation_documents;
create policy "organization_import_operation_documents_select_member"
on public.organization_import_operation_documents
for select
using (public.is_active_member(organization_id));

drop policy if exists "organization_import_operation_documents_insert_accounting_roles" on public.organization_import_operation_documents;
create policy "organization_import_operation_documents_insert_accounting_roles"
on public.organization_import_operation_documents
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

drop policy if exists "organization_import_operation_documents_update_accounting_roles" on public.organization_import_operation_documents;
create policy "organization_import_operation_documents_update_accounting_roles"
on public.organization_import_operation_documents
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

drop policy if exists "organization_import_operation_taxes_select_member" on public.organization_import_operation_taxes;
create policy "organization_import_operation_taxes_select_member"
on public.organization_import_operation_taxes
for select
using (public.is_active_member(organization_id));

drop policy if exists "organization_import_operation_taxes_insert_accounting_roles" on public.organization_import_operation_taxes;
create policy "organization_import_operation_taxes_insert_accounting_roles"
on public.organization_import_operation_taxes
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

drop policy if exists "organization_import_operation_taxes_update_accounting_roles" on public.organization_import_operation_taxes;
create policy "organization_import_operation_taxes_update_accounting_roles"
on public.organization_import_operation_taxes
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

drop policy if exists "organization_dgi_form_mappings_select_member" on public.organization_dgi_form_mappings;
create policy "organization_dgi_form_mappings_select_member"
on public.organization_dgi_form_mappings
for select
using (public.is_active_member(organization_id));

drop policy if exists "organization_dgi_form_mappings_insert_accounting_roles" on public.organization_dgi_form_mappings;
create policy "organization_dgi_form_mappings_insert_accounting_roles"
on public.organization_dgi_form_mappings
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "organization_dgi_form_mappings_update_accounting_roles" on public.organization_dgi_form_mappings;
create policy "organization_dgi_form_mappings_update_accounting_roles"
on public.organization_dgi_form_mappings
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "vat_form_exports_select_member" on public.vat_form_exports;
create policy "vat_form_exports_select_member"
on public.vat_form_exports
for select
using (public.is_active_member(organization_id));

drop policy if exists "vat_form_exports_insert_accounting_roles" on public.vat_form_exports;
create policy "vat_form_exports_insert_accounting_roles"
on public.vat_form_exports
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);
