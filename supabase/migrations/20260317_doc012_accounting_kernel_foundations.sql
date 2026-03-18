do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'fiscal_period_status'
  ) then
    create type public.fiscal_period_status as enum (
      'open',
      'review',
      'closed',
      'locked'
    );
  end if;
end
$$;

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
  legacy_vendor_id uuid references public.vendors(id) on delete set null,
  legacy_customer_id uuid references public.customers(id) on delete set null,
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
  add column if not exists source_channel text not null default 'document_workflow',
  add column if not exists provider_meta_json jsonb not null default '{}'::jsonb,
  add column if not exists jurisdiction_meta_json jsonb not null default '{}'::jsonb;

update public.chart_of_accounts
set natural_balance = coalesce(natural_balance, normal_side)
where natural_balance is null;

alter table public.chart_of_accounts
  drop constraint if exists chart_of_accounts_group_id_fkey;

alter table public.chart_of_accounts
  add constraint chart_of_accounts_group_id_fkey
    foreign key (group_id)
    references public.account_groups(id)
    on delete set null;

create index if not exists idx_chart_of_accounts_org_group
  on public.chart_of_accounts (organization_id, group_id)
  where group_id is not null;

create index if not exists idx_chart_of_accounts_org_source_channel
  on public.chart_of_accounts (organization_id, source_channel);

create table if not exists public.fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  status public.fiscal_period_status not null default 'open',
  is_current boolean not null default false,
  closed_at timestamptz,
  locked_at timestamptz,
  reopened_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, starts_on, ends_on)
);

create index if not exists idx_fiscal_periods_org_dates
  on public.fiscal_periods (organization_id, starts_on, ends_on);

create table if not exists public.organization_accounting_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_number integer not null,
  status text not null default 'active',
  fingerprint text not null,
  effective_from timestamptz not null default now(),
  source_rule_snapshot_id uuid,
  snapshot_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, version_number),
  unique (organization_id, fingerprint)
);

create index if not exists idx_org_accounting_snapshots_org_effective
  on public.organization_accounting_snapshots (organization_id, effective_from desc);

create table if not exists public.source_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_channel text not null,
  source_entity_type text not null,
  source_entity_id uuid,
  source_external_id text,
  source_document_id uuid references public.documents(id) on delete set null,
  binary_hash text,
  payload_hash text,
  source_ref_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_source_events_org_entity
  on public.source_events (organization_id, source_channel, source_entity_type, source_entity_id);

create index if not exists idx_source_events_org_binary_hash
  on public.source_events (organization_id, binary_hash)
  where binary_hash is not null;

create table if not exists public.source_event_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_event_id uuid not null references public.source_events(id) on delete cascade,
  source_document_id uuid references public.documents(id) on delete set null,
  draft_id uuid,
  version_no integer not null,
  facts_json jsonb not null default '{}'::jsonb,
  amount_breakdown_json jsonb not null default '[]'::jsonb,
  line_items_json jsonb not null default '[]'::jsonb,
  payload_hash text,
  source_binary_hash text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (source_event_id, version_no)
);

create index if not exists idx_source_event_facts_org_event
  on public.source_event_facts (organization_id, source_event_id, version_no desc);

create table if not exists public.posting_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_event_id uuid not null references public.source_events(id) on delete cascade,
  source_event_facts_id uuid not null references public.source_event_facts(id) on delete cascade,
  source_event_facts_version_no integer not null,
  accounting_snapshot_id uuid references public.organization_accounting_snapshots(id) on delete set null,
  proposal_version_no integer not null,
  status text not null default 'draft',
  posting_mode public.journal_posting_mode not null default 'final',
  proposal_hash text not null,
  explanation text,
  journal_preview_json jsonb not null default '{}'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  blockers_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_event_id, proposal_version_no)
);

create index if not exists idx_posting_proposals_org_event
  on public.posting_proposals (organization_id, source_event_id, proposal_version_no desc);

create table if not exists public.posting_proposal_lines (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.posting_proposals(id) on delete cascade,
  line_no integer not null,
  account_id uuid references public.chart_of_accounts(id) on delete set null,
  side public.normal_side not null,
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  original_currency_code text,
  debit_original numeric(18,2),
  credit_original numeric(18,2),
  functional_currency_code text,
  functional_debit numeric(18,2) not null default 0,
  functional_credit numeric(18,2) not null default 0,
  fx_rate_applied numeric(18,6),
  tax_tag text,
  party_id uuid references public.parties(id) on delete set null,
  tax_code_id uuid,
  role_code text,
  line_purpose text,
  tax_component text,
  settlement_component text,
  source_ref_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  unique (proposal_id, line_no)
);

create table if not exists public.posting_decision_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_event_id uuid references public.source_events(id) on delete cascade,
  source_event_facts_id uuid references public.source_event_facts(id) on delete cascade,
  posting_proposal_id uuid references public.posting_proposals(id) on delete cascade,
  decision_stage text not null,
  decision_source text not null,
  explanation text,
  decision_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.journal_entries
  add column if not exists fiscal_period_id uuid references public.fiscal_periods(id) on delete set null,
  add column if not exists journal_type_id uuid references public.journal_types(id) on delete set null,
  add column if not exists auxiliary_book_id uuid references public.auxiliary_books(id) on delete set null,
  add column if not exists source_channel text not null default 'documents',
  add column if not exists source_system text not null default 'convertilabs',
  add column if not exists source_event_id uuid references public.source_events(id) on delete set null,
  add column if not exists posting_proposal_id uuid references public.posting_proposals(id) on delete set null,
  add column if not exists accounting_snapshot_id uuid references public.organization_accounting_snapshots(id) on delete set null,
  add column if not exists provider_connection_id uuid,
  add column if not exists provider_managed boolean not null default false,
  add column if not exists source_provider text,
  add column if not exists source_hash text,
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists immutable_at timestamptz,
  add column if not exists legacy_immutable boolean not null default false,
  add column if not exists reverses_journal_entry_id uuid references public.journal_entries(id) on delete set null,
  add column if not exists reversed_by_journal_entry_id uuid references public.journal_entries(id) on delete set null,
  add column if not exists adjusts_journal_entry_id uuid references public.journal_entries(id) on delete set null,
  add column if not exists annulment_reason text;

update public.journal_entries
set
  source_channel = coalesce(nullif(source_channel, ''), 'documents'),
  source_system = coalesce(nullif(source_system, ''), 'convertilabs'),
  first_seen_at = coalesce(first_seen_at, created_at, now()),
  last_seen_at = coalesce(last_seen_at, updated_at, created_at, now()),
  legacy_immutable = coalesce(legacy_immutable, false)
where true;

create index if not exists idx_journal_entries_org_source_event
  on public.journal_entries (organization_id, source_event_id, created_at desc);

alter table public.journal_entry_lines
  add column if not exists party_id uuid references public.parties(id) on delete set null,
  add column if not exists tax_code_id uuid,
  add column if not exists debit_original numeric(18,2),
  add column if not exists credit_original numeric(18,2),
  add column if not exists functional_currency_code text,
  add column if not exists role_code text,
  add column if not exists line_purpose text,
  add column if not exists tax_component text,
  add column if not exists settlement_component text,
  add column if not exists source_ref_json jsonb not null default '{}'::jsonb,
  add column if not exists source_hash text,
  add column if not exists provider_managed boolean not null default false;

update public.journal_entry_lines as jel
set
  debit_original = coalesce(jel.debit_original, nullif(jel.debit, 0), 0),
  credit_original = coalesce(jel.credit_original, nullif(jel.credit, 0), 0),
  functional_currency_code = coalesce(jel.functional_currency_code, je.functional_currency_code, je.functional_currency, 'UYU'),
  role_code = coalesce(jel.role_code, nullif(jel.metadata ->> 'role_code', '')),
  line_purpose = coalesce(jel.line_purpose, nullif(jel.metadata ->> 'line_purpose', '')),
  tax_component = coalesce(jel.tax_component, nullif(jel.metadata ->> 'tax_component', '')),
  settlement_component = coalesce(jel.settlement_component, nullif(jel.metadata ->> 'settlement_component', ''))
from public.journal_entries as je
where je.id = jel.journal_entry_id;

alter table public.ledger_open_items
  alter column source_document_id drop not null;

alter table public.ledger_open_items
  add column if not exists party_id uuid references public.parties(id) on delete set null,
  add column if not exists source_channel text not null default 'documents',
  add column if not exists source_entity_type text,
  add column if not exists source_entity_id uuid,
  add column if not exists source_ref_json jsonb not null default '{}'::jsonb,
  add column if not exists opening_journal_entry_line_id uuid references public.journal_entry_lines(id) on delete set null,
  add column if not exists provider_connection_id uuid,
  add column if not exists provider_managed boolean not null default false,
  add column if not exists source_hash text;

update public.ledger_open_items
set source_channel = coalesce(nullif(source_channel, ''), 'documents')
where true;

alter table public.ledger_settlement_links
  add column if not exists settlement_journal_entry_line_id uuid references public.journal_entry_lines(id) on delete set null,
  add column if not exists source_channel text not null default 'documents',
  add column if not exists source_entity_type text,
  add column if not exists source_entity_id uuid,
  add column if not exists source_ref_json jsonb not null default '{}'::jsonb;
