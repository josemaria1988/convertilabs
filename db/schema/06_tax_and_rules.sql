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
  adjustments numeric(18,2) not null default 0,
  net_vat_payable numeric(18,2) not null default 0,
  version_no integer not null default 1,
  created_by uuid references public.profiles(id),
  finalized_by uuid references public.profiles(id),
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);
