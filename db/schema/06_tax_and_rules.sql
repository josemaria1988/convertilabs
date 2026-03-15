create table if not exists public.normative_packages (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'UY',
  tax_type public.tax_type not null,
  package_year integer not null,
  name text not null,
  status text not null default 'active',
  effective_from date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (country_code, tax_type, package_year, name)
);

create table if not exists public.normative_documents (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.normative_packages(id) on delete cascade,
  title text not null,
  document_type text,
  source_reference text,
  storage_bucket text not null default 'normative-private',
  storage_path text,
  extracted_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  package_id uuid references public.normative_packages(id) on delete cascade,
  tax_type public.tax_type not null,
  scope public.rule_scope not null,
  name text not null,
  priority integer not null default 0,
  active boolean not null default true,
  valid_from date,
  valid_to date,
  conditions_json jsonb not null default '[]'::jsonb,
  effects_json jsonb not null default '[]'::jsonb,
  source_reference text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_tax_rules_scope_active
  on public.tax_rules (tax_type, scope, active);

create table if not exists public.tax_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tax_type public.tax_type not null,
  period_year integer not null,
  period_month integer,
  start_date date not null,
  end_date date not null,
  status public.tax_period_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tax_type, period_year, period_month)
);

create table if not exists public.vat_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.tax_periods(id) on delete cascade,
  status text not null default 'draft',
  input_snapshot_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  output_vat numeric(18,2) not null default 0,
  input_vat_creditable numeric(18,2) not null default 0,
  input_vat_non_deductible numeric(18,2) not null default 0,
  import_vat numeric(18,2) not null default 0,
  import_vat_advance numeric(18,2) not null default 0,
  adjustments numeric(18,2) not null default 0,
  net_vat_payable numeric(18,2) not null default 0,
  version_no integer not null default 1,
  created_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  finalized_by uuid references public.profiles(id),
  finalized_at timestamptz,
  locked_by uuid references public.profiles(id),
  locked_at timestamptz,
  reopened_by uuid references public.profiles(id),
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_vat_runs_org_period_version
  on public.vat_runs (organization_id, period_id, version_no);

create table if not exists public.dgi_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_year integer not null,
  period_month integer not null,
  source_kind public.dgi_reconciliation_source_kind not null default 'manual_summary',
  status public.dgi_reconciliation_run_status not null default 'draft',
  baseline_payload jsonb not null default '{}'::jsonb,
  differences_payload jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dgi_reconciliation_runs_org_period
  on public.dgi_reconciliation_runs (organization_id, period_year, period_month, created_at desc);

create table if not exists public.dgi_reconciliation_buckets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.dgi_reconciliation_runs(id) on delete cascade,
  bucket_code text not null,
  dgi_net_amount_uyu numeric(18,2) not null default 0,
  system_net_amount_uyu numeric(18,2) not null default 0,
  dgi_tax_amount_uyu numeric(18,2) not null default 0,
  system_tax_amount_uyu numeric(18,2) not null default 0,
  delta_net_amount_uyu numeric(18,2) not null default 0,
  delta_tax_amount_uyu numeric(18,2) not null default 0,
  difference_status public.dgi_reconciliation_difference_status not null default 'matched',
  notes text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, bucket_code)
);

create index if not exists idx_dgi_reconciliation_buckets_org_run
  on public.dgi_reconciliation_buckets (organization_id, run_id, bucket_code);

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
