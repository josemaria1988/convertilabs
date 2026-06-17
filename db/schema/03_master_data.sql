create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  account_type public.account_type not null,
  normal_side public.normal_side not null,
  is_postable boolean not null default true,
  is_provisional boolean not null default false,
  source text not null default 'manual',
  external_code text,
  statement_section text,
  nature_tag text,
  function_tag text,
  cashflow_tag text,
  tax_profile_hint text,
  currency_policy text not null default 'mono_currency',
  parent_id uuid references public.chart_of_accounts(id),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table public.chart_of_accounts
  add column if not exists chapter_code text,
  add column if not exists presentation_code text,
  add column if not exists group_id uuid,
  add column if not exists currency_code text,
  add column if not exists natural_balance public.normal_side,
  add column if not exists requires_party boolean not null default false,
  add column if not exists reconciliable boolean not null default false,
  add column if not exists tax_account_kind text,
  add column if not exists include_fx_revaluation boolean not null default false,
  add column if not exists cost_center_policy text not null default 'optional',
  add column if not exists sort_order integer,
  add column if not exists provider_managed boolean not null default false,
  add column if not exists source_provider text,
  add column if not exists external_parent_code text,
  add column if not exists account_level integer,
  add column if not exists is_imputable boolean,
  add column if not exists uses_cost_centers boolean,
  add column if not exists literal_tributario integer,
  add column if not exists source_channel text not null default 'document_workflow',
  add column if not exists provider_meta_json jsonb not null default '{}'::jsonb,
  add column if not exists jurisdiction_meta_json jsonb not null default '{}'::jsonb,
  add column if not exists last_synced_from_provider_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chart_of_accounts_org_provider_external_code_key'
      and conrelid = 'public.chart_of_accounts'::regclass
  ) then
    alter table public.chart_of_accounts
      add constraint chart_of_accounts_org_provider_external_code_key
      unique (organization_id, source_provider, external_code);
  end if;
end
$$;

create table if not exists public.uy_locations (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  city text not null,
  postal_code text,
  lat numeric(10,6) not null,
  long numeric(10,6) not null,
  source text not null default 'seed_v1',
  source_version text not null default '2026-03-step5-location-v1',
  created_at timestamptz not null default now(),
  unique (department, city)
);

update public.chart_of_accounts
set natural_balance = coalesce(natural_balance, normal_side)
where natural_balance is null;

create table if not exists public.account_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_account_groups_org_code
  on public.account_groups (organization_id, code);

create index if not exists idx_chart_of_accounts_org_provider_imputable
  on public.chart_of_accounts (
    organization_id,
    source_provider,
    is_imputable,
    external_code
  )
  where source_provider is not null;

alter table public.chart_of_accounts
  drop constraint if exists chart_of_accounts_group_id_fkey;

alter table public.chart_of_accounts
  add constraint chart_of_accounts_group_id_fkey
    foreign key (group_id)
    references public.account_groups(id)
    on delete set null;

insert into public.uy_locations (department, city, postal_code, lat, long, source, source_version)
values
  ('montevideo', 'montevideo', '11000', -34.901100, -56.164500, 'seed_v1', '2026-03-step5-location-v1'),
  ('canelones', 'canelones', '90000', -34.522800, -56.277800, 'seed_v1', '2026-03-step5-location-v1'),
  ('canelones', 'las piedras', '90200', -34.730200, -56.219200, 'seed_v1', '2026-03-step5-location-v1'),
  ('canelones', 'ciudad de la costa', '15000', -34.816700, -55.950000, 'seed_v1', '2026-03-step5-location-v1'),
  ('maldonado', 'maldonado', '20000', -34.900000, -54.950000, 'seed_v1', '2026-03-step5-location-v1'),
  ('maldonado', 'punta del este', '20100', -34.962700, -54.945100, 'seed_v1', '2026-03-step5-location-v1'),
  ('colonia', 'colonia del sacramento', '70000', -34.471100, -57.844200, 'seed_v1', '2026-03-step5-location-v1'),
  ('salto', 'salto', '50000', -31.383300, -57.966700, 'seed_v1', '2026-03-step5-location-v1'),
  ('paysandu', 'paysandu', '60000', -32.321400, -58.075600, 'seed_v1', '2026-03-step5-location-v1'),
  ('rivera', 'rivera', '40000', -30.905300, -55.550800, 'seed_v1', '2026-03-step5-location-v1'),
  ('rocha', 'rocha', '27000', -34.483300, -54.333300, 'seed_v1', '2026-03-step5-location-v1'),
  ('lavalleja', 'minas', '30000', -34.375900, -55.237700, 'seed_v1', '2026-03-step5-location-v1'),
  ('soriano', 'mercedes', '75000', -33.252400, -58.030500, 'seed_v1', '2026-03-step5-location-v1'),
  ('san jose', 'san jose de mayo', '80000', -34.337500, -56.713600, 'seed_v1', '2026-03-step5-location-v1'),
  ('florida', 'florida', '94000', -34.095600, -56.214200, 'seed_v1', '2026-03-step5-location-v1'),
  ('flores', 'trinidad', '85000', -33.516500, -56.899600, 'seed_v1', '2026-03-step5-location-v1'),
  ('tacuarembo', 'tacuarembo', '45000', -31.716900, -55.981100, 'seed_v1', '2026-03-step5-location-v1'),
  ('durazno', 'durazno', '97000', -33.380600, -56.523600, 'seed_v1', '2026-03-step5-location-v1'),
  ('treinta y tres', 'treinta y tres', '33000', -33.233300, -54.383300, 'seed_v1', '2026-03-step5-location-v1'),
  ('rio negro', 'fray bentos', '65000', -33.116500, -58.310700, 'seed_v1', '2026-03-step5-location-v1'),
  ('cerro largo', 'melo', '37000', -32.370300, -54.167500, 'seed_v1', '2026-03-step5-location-v1'),
  ('artigas', 'artigas', '55000', -30.400000, -56.466700, 'seed_v1', '2026-03-step5-location-v1')
on conflict (department, city) do nothing;

create table if not exists public.currencies (
  code text primary key,
  name text not null,
  symbol text,
  decimals smallint not null default 2,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.currencies (code, name, symbol, decimals)
values
  ('UYU', 'Peso Uruguayo', '$', 2),
  ('USD', 'US Dollar', 'US$', 2),
  ('EUR', 'Euro', 'EUR', 2)
on conflict (code) do update
set
  name = excluded.name,
  symbol = excluded.symbol,
  decimals = excluded.decimals,
  updated_at = now();

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  base_currency_code text not null references public.currencies(code),
  quote_currency_code text not null references public.currencies(code),
  rate_type text not null default 'spot',
  rate numeric(18,6) not null,
  effective_date date not null,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, base_currency_code, quote_currency_code, rate_type, effective_date)
);

create index if not exists idx_exchange_rates_org_date
  on public.exchange_rates (organization_id, effective_date desc);

create table if not exists public.auxiliary_books (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_auxiliary_books_org_code
  on public.auxiliary_books (organization_id, code);

create table if not exists public.journal_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_journal_types_org_code
  on public.journal_types (organization_id, code);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  party_kind text not null default 'external',
  legal_name text not null,
  display_name text,
  tax_id text,
  tax_id_normalized text,
  legacy_vendor_id uuid,
  legacy_customer_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_parties_org_tax_id_normalized
  on public.parties (organization_id, tax_id_normalized)
  where tax_id_normalized is not null;

create index if not exists idx_parties_org_display_name
  on public.parties (organization_id, display_name);

create table if not exists public.accounting_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  functional_currency_code text not null default 'UYU' references public.currencies(code),
  chapter_codes_json jsonb not null default '[]'::jsonb,
  modifications_locked_before date,
  uses_foreign_currency boolean not null default false,
  uses_cost_centers boolean not null default false,
  uses_references boolean not null default false,
  uses_tax_literals boolean not null default false,
  shared_exchange_rate_source_organization_id uuid references public.organizations(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_cost_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  archived_by uuid references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_org_cost_centers_org_name_active
  on public.organization_cost_centers (organization_id, lower(name))
  where is_active = true;

create index if not exists idx_org_cost_centers_org_active_created
  on public.organization_cost_centers (organization_id, is_active, created_at desc);

create table if not exists public.account_role_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  binding_key text not null,
  role_code text not null,
  account_id uuid not null references public.chart_of_accounts(id) on delete cascade,
  document_role public.document_direction,
  currency_code text references public.currencies(code),
  settlement_method text,
  priority integer not null default 0,
  source text not null default 'manual',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, binding_key)
);

create index if not exists idx_account_role_bindings_org_role
  on public.account_role_bindings (organization_id, role_code, is_active, priority desc);

create index if not exists idx_account_role_bindings_org_account
  on public.account_role_bindings (organization_id, account_id);

insert into public.account_role_bindings (
  organization_id,
  binding_key,
  role_code,
  account_id,
  currency_code,
  priority,
  source,
  metadata
)
select
  coa.organization_id,
  coalesce(
    nullif(coa.metadata ->> 'semantic_key', ''),
    format('%s:%s', mapped.role_code, coa.code)
  ),
  mapped.role_code,
  coa.id,
  coa.currency_code,
  100,
  'system_role_backfill',
  jsonb_build_object(
    'backfilled_from_system_role',
    coa.metadata ->> 'system_role'
  )
from public.chart_of_accounts as coa
cross join lateral (
  values
    (case when coa.metadata ->> 'system_role' in ('revenue_account') then 'revenue_account' end),
    (case when coa.metadata ->> 'system_role' in ('expense_account') then 'expense_account' end),
    (case when coa.metadata ->> 'system_role' in ('inventory_account') then 'inventory_account' end),
    (case when coa.metadata ->> 'system_role' in ('fixed_asset_account') then 'fixed_asset_account' end),
    (case when coa.metadata ->> 'system_role' in ('output_vat_account', 'vat_output_payable') then 'output_vat_account' end),
    (case when coa.metadata ->> 'system_role' in ('input_vat_account', 'vat_input_creditable') then 'input_vat_account' end),
    (case when coa.metadata ->> 'system_role' in ('accounts_receivable_account', 'accounts_receivable') then 'accounts_receivable_account' end),
    (case when coa.metadata ->> 'system_role' in ('accounts_payable_account', 'accounts_payable') then 'accounts_payable_account' end),
    (case when coa.metadata ->> 'system_role' in ('cash_account') then 'cash_account' end),
    (case when coa.metadata ->> 'system_role' in ('bank_account') then 'bank_account' end),
    (case when coa.metadata ->> 'system_role' in ('card_clearing_account') then 'card_clearing_account' end),
    (case when coa.metadata ->> 'system_role' in ('check_clearing_account') then 'check_clearing_account' end),
    (case when coa.metadata ->> 'system_role' in ('cash_sales_unidentified_account') then 'cash_sales_unidentified_account' end),
    (case when coa.metadata ->> 'system_role' in ('cash_purchases_unidentified_account') then 'cash_purchases_unidentified_account' end),
    (case when coa.metadata ->> 'system_role' in ('bank_fees_account') then 'bank_fees_account' end),
    (case when coa.metadata ->> 'system_role' in ('fx_difference_account') then 'fx_difference_account' end)
) as mapped(role_code)
where mapped.role_code is not null
on conflict (organization_id, binding_key) do update
set
  role_code = excluded.role_code,
  account_id = excluded.account_id,
  currency_code = excluded.currency_code,
  priority = excluded.priority,
  metadata = public.account_role_bindings.metadata || excluded.metadata,
  updated_at = now();

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

alter table public.vendors
  add column if not exists fiscal_address_text text,
  add column if not exists fiscal_department text,
  add column if not exists fiscal_city text,
  add column if not exists fiscal_lat numeric(10,6),
  add column if not exists fiscal_long numeric(10,6),
  add column if not exists issuer_branch_code text,
  add column if not exists merchant_category_hint text,
  add column if not exists location_confidence numeric(10,6);

create unique index if not exists idx_vendors_org_tax_id_normalized
  on public.vendors (organization_id, tax_id_normalized)
  where tax_id_normalized is not null;

create index if not exists idx_chart_of_accounts_org_external_code
  on public.chart_of_accounts (organization_id, external_code)
  where external_code is not null;

create index if not exists idx_chart_of_accounts_org_group
  on public.chart_of_accounts (organization_id, group_id)
  where group_id is not null;

create index if not exists idx_chart_of_accounts_org_source_channel
  on public.chart_of_accounts (organization_id, source_channel);

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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'parties_legacy_vendor_id_fkey'
      and conrelid = 'public.parties'::regclass
  ) then
    alter table public.parties
      add constraint parties_legacy_vendor_id_fkey
      foreign key (legacy_vendor_id)
      references public.vendors(id)
      on delete set null
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'parties_legacy_customer_id_fkey'
      and conrelid = 'public.parties'::regclass
  ) then
    alter table public.parties
      add constraint parties_legacy_customer_id_fkey
      foreign key (legacy_customer_id)
      references public.customers(id)
      on delete set null
      not valid;
  end if;
end
$$;
