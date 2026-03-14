create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  account_type public.account_type not null,
  normal_side public.normal_side not null,
  is_postable boolean not null default true,
  parent_id uuid references public.chart_of_accounts(id),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  tax_id_normalized text,
  name_normalized text,
  default_account_id uuid references public.chart_of_accounts(id),
  default_payment_account_id uuid references public.chart_of_accounts(id),
  default_tax_profile jsonb not null default '{}'::jsonb,
  default_operation_category text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_vendors_org_tax_id_normalized
  on public.vendors (organization_id, tax_id_normalized)
  where tax_id_normalized is not null;

create index if not exists idx_vendors_org_name_normalized
  on public.vendors (organization_id, name_normalized);

create table if not exists public.vendor_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  alias_display text,
  alias_normalized text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, vendor_id, alias_normalized)
);

create index if not exists idx_vendor_aliases_org_alias
  on public.vendor_aliases (organization_id, alias_normalized);

create table if not exists public.organization_concepts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  canonical_name text not null,
  description text,
  document_role public.document_direction not null default 'purchase',
  default_account_id uuid references public.chart_of_accounts(id),
  default_vat_profile_json jsonb not null default '{}'::jsonb,
  default_operation_category text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_organization_concepts_org_role_active
  on public.organization_concepts (organization_id, document_role, is_active);

create table if not exists public.organization_concept_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  concept_id uuid not null references public.organization_concepts(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  alias_code_normalized text,
  alias_description_normalized text not null,
  match_scope text not null default 'organization',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_concept_aliases_org_vendor_code
  on public.organization_concept_aliases (
    organization_id,
    vendor_id,
    alias_code_normalized
  );

create index if not exists idx_org_concept_aliases_org_vendor_description
  on public.organization_concept_aliases (
    organization_id,
    vendor_id,
    alias_description_normalized
  );

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  tax_id_normalized text,
  name_normalized text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_customers_org_tax_id_normalized
  on public.customers (organization_id, tax_id_normalized)
  where tax_id_normalized is not null;

create index if not exists idx_customers_org_name_normalized
  on public.customers (organization_id, name_normalized);
