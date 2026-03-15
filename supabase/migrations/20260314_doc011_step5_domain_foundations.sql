do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'document_posting_status'
  ) then
    create type public.document_posting_status as enum (
      'draft',
      'vat_ready',
      'posted_provisional',
      'posted_final',
      'locked'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'journal_posting_mode'
  ) then
    create type public.journal_posting_mode as enum (
      'provisional',
      'final'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'accounting_rule_status'
  ) then
    create type public.accounting_rule_status as enum (
      'candidate',
      'provisional',
      'approved'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'dgi_reconciliation_source_kind'
  ) then
    create type public.dgi_reconciliation_source_kind as enum (
      'manual_summary',
      'imported_file',
      'future_connector'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'dgi_reconciliation_run_status'
  ) then
    create type public.dgi_reconciliation_run_status as enum (
      'draft',
      'computed',
      'reviewed',
      'closed'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'dgi_reconciliation_difference_status'
  ) then
    create type public.dgi_reconciliation_difference_status as enum (
      'matched',
      'missing_in_system',
      'extra_in_system',
      'amount_mismatch',
      'tax_treatment_mismatch',
      'pending_manual_adjustment'
    );
  end if;
end
$$;

alter table public.documents
  add column if not exists posting_status public.document_posting_status not null default 'draft',
  add column if not exists vat_ready_at timestamptz,
  add column if not exists posted_provisional_at timestamptz,
  add column if not exists posted_final_at timestamptz,
  add column if not exists document_currency_code text,
  add column if not exists document_net_amount_original numeric(18,2),
  add column if not exists document_tax_amount_original numeric(18,2),
  add column if not exists document_total_amount_original numeric(18,2),
  add column if not exists net_amount_uyu numeric(18,2),
  add column if not exists tax_amount_uyu numeric(18,2),
  add column if not exists total_amount_uyu numeric(18,2),
  add column if not exists fx_rate_policy_code text,
  add column if not exists fx_rate_bcu_value numeric(18,6),
  add column if not exists fx_rate_bcu_date_used date,
  add column if not exists fx_rate_bcu_series text,
  add column if not exists fx_rate_document_value numeric(18,6),
  add column if not exists fx_rate_document_date date,
  add column if not exists fx_rate_source text,
  add column if not exists fx_rate_override_reason text,
  add column if not exists vat_credit_category text,
  add column if not exists vat_deductibility_status text,
  add column if not exists vat_direct_tax_amount_uyu numeric(18,2),
  add column if not exists vat_indirect_tax_amount_uyu numeric(18,2),
  add column if not exists vat_deductible_tax_amount_uyu numeric(18,2),
  add column if not exists vat_nondeductible_tax_amount_uyu numeric(18,2),
  add column if not exists vat_proration_coefficient numeric(10,6),
  add column if not exists business_link_status text,
  add column if not exists dgi_reconciliation_status text;

create index if not exists idx_documents_org_posting_status
  on public.documents (organization_id, posting_status, created_at desc);

update public.documents
set
  posting_status = 'posted_final',
  posted_final_at = coalesce(posted_final_at, updated_at, created_at)
where exists (
  select 1
  from public.document_confirmations confirmations
  where confirmations.document_id = documents.id
)
and posting_status = 'draft';

alter table public.chart_of_accounts
  add column if not exists is_provisional boolean not null default false,
  add column if not exists source text not null default 'manual',
  add column if not exists external_code text,
  add column if not exists statement_section text,
  add column if not exists nature_tag text,
  add column if not exists function_tag text,
  add column if not exists cashflow_tag text,
  add column if not exists tax_profile_hint text,
  add column if not exists currency_policy text not null default 'mono_currency';

create index if not exists idx_chart_of_accounts_org_external_code
  on public.chart_of_accounts (organization_id, external_code)
  where external_code is not null;

update public.chart_of_accounts
set
  source = coalesce(nullif(metadata ->> 'source', ''), source),
  external_code = coalesce(nullif(metadata ->> 'external_code', ''), external_code),
  statement_section = coalesce(nullif(metadata ->> 'statement_section', ''), statement_section),
  nature_tag = coalesce(nullif(metadata ->> 'nature_tag', ''), nature_tag),
  function_tag = coalesce(nullif(metadata ->> 'function_tag', ''), function_tag),
  cashflow_tag = coalesce(nullif(metadata ->> 'cashflow_tag', ''), cashflow_tag),
  tax_profile_hint = coalesce(nullif(metadata ->> 'tax_profile_hint', ''), tax_profile_hint),
  currency_policy = coalesce(nullif(metadata ->> 'currency_policy', ''), currency_policy),
  is_provisional = coalesce((metadata ->> 'is_provisional')::boolean, is_provisional)
where metadata <> '{}'::jsonb;

alter table public.accounting_rules
  add column if not exists status public.accounting_rule_status not null default 'approved',
  add column if not exists source_document_id uuid references public.documents(id) on delete cascade,
  add column if not exists template_code text,
  add column if not exists tax_profile_code text,
  add column if not exists times_reused integer not null default 0,
  add column if not exists times_corrected integer not null default 0;

create index if not exists idx_accounting_rules_org_status_scope
  on public.accounting_rules (organization_id, status, scope, is_active, priority desc);

update public.accounting_rules
set source_document_id = coalesce(source_document_id, document_id)
where source_document_id is null
  and document_id is not null;

alter table public.journal_entries
  add column if not exists posting_mode public.journal_posting_mode not null default 'final',
  add column if not exists functional_currency text not null default 'UYU',
  add column if not exists source_currency_present boolean not null default false,
  add column if not exists fx_rate_bcu_value numeric(18,6),
  add column if not exists fx_rate_bcu_date_used date;

update public.journal_entries
set functional_currency = coalesce(nullif(functional_currency_code, ''), functional_currency, 'UYU');

alter table public.journal_entry_lines
  add column if not exists original_currency_code text,
  add column if not exists original_amount numeric(18,2),
  add column if not exists functional_amount_uyu numeric(18,2),
  add column if not exists fx_rate_applied numeric(18,6);

update public.journal_entry_lines
set
  original_currency_code = coalesce(original_currency_code, currency_code),
  original_amount = coalesce(original_amount, nullif(debit, 0), nullif(credit, 0), 0),
  functional_amount_uyu = coalesce(functional_amount_uyu, functional_debit, functional_credit, 0),
  fx_rate_applied = coalesce(fx_rate_applied, fx_rate, 1);

alter table public.ledger_open_items
  add column if not exists original_currency_code text,
  add column if not exists original_amount numeric(18,2),
  add column if not exists functional_amount_origin_uyu numeric(18,2),
  add column if not exists fx_rate_origin numeric(18,6),
  add column if not exists fx_rate_origin_date date;

update public.ledger_open_items
set
  original_currency_code = coalesce(original_currency_code, currency_code),
  original_amount = coalesce(original_amount, ledger_open_items.original_amount, outstanding_amount, 0),
  functional_amount_origin_uyu = coalesce(functional_amount_origin_uyu, functional_amount, 0),
  fx_rate_origin = coalesce(fx_rate_origin, fx_rate, 1),
  fx_rate_origin_date = coalesce(fx_rate_origin_date, fx_rate_date);

alter table public.organization_spreadsheet_import_runs
  add column if not exists ai_parse_status text,
  add column if not exists ai_parse_payload jsonb not null default '{}'::jsonb,
  add column if not exists normalized_payload jsonb not null default '{}'::jsonb,
  add column if not exists error_report jsonb not null default '{}'::jsonb;

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

alter table public.dgi_reconciliation_runs enable row level security;
alter table public.dgi_reconciliation_buckets enable row level security;

drop policy if exists "dgi_reconciliation_runs_select_member" on public.dgi_reconciliation_runs;
create policy "dgi_reconciliation_runs_select_member"
on public.dgi_reconciliation_runs
for select
using (public.is_active_member(organization_id));

drop policy if exists "dgi_reconciliation_runs_insert_accounting_roles" on public.dgi_reconciliation_runs;
create policy "dgi_reconciliation_runs_insert_accounting_roles"
on public.dgi_reconciliation_runs
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

drop policy if exists "dgi_reconciliation_runs_update_accounting_roles" on public.dgi_reconciliation_runs;
create policy "dgi_reconciliation_runs_update_accounting_roles"
on public.dgi_reconciliation_runs
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
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
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "dgi_reconciliation_buckets_select_member" on public.dgi_reconciliation_buckets;
create policy "dgi_reconciliation_buckets_select_member"
on public.dgi_reconciliation_buckets
for select
using (public.is_active_member(organization_id));

drop policy if exists "dgi_reconciliation_buckets_insert_accounting_roles" on public.dgi_reconciliation_buckets;
create policy "dgi_reconciliation_buckets_insert_accounting_roles"
on public.dgi_reconciliation_buckets
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

drop policy if exists "dgi_reconciliation_buckets_update_accounting_roles" on public.dgi_reconciliation_buckets;
create policy "dgi_reconciliation_buckets_update_accounting_roles"
on public.dgi_reconciliation_buckets
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
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
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);
