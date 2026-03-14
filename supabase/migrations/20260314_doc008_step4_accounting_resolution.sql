alter table public.customers
  add column if not exists tax_id_normalized text,
  add column if not exists name_normalized text;

update public.customers
set
  tax_id_normalized = nullif(regexp_replace(coalesce(tax_id, ''), '\D+', '', 'g'), ''),
  name_normalized = nullif(
    lower(
      trim(
        regexp_replace(
          translate(
            coalesce(name, ''),
            'ÁÀÂÄáàâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖóòôöÚÙÛÜúùûüÑñ',
            'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNn'
          ),
          '\s+',
          ' ',
          'g'
        )
      )
    ),
    ''
  ),
  updated_at = now()
where tax_id is not null
   or name is not null;

create unique index if not exists idx_customers_org_tax_id_normalized
  on public.customers (organization_id, tax_id_normalized)
  where tax_id_normalized is not null;

create index if not exists idx_customers_org_name_normalized
  on public.customers (organization_id, name_normalized);

alter table public.journal_entries
  add column if not exists fx_rate numeric(18,6) not null default 1,
  add column if not exists fx_rate_date date,
  add column if not exists fx_rate_source text not null default 'same_currency',
  add column if not exists functional_currency_code text not null default 'UYU',
  add column if not exists functional_total_debit numeric(18,2) not null default 0,
  add column if not exists functional_total_credit numeric(18,2) not null default 0;

update public.journal_entries
set
  functional_currency_code = coalesce(functional_currency_code, currency_code, 'UYU'),
  functional_total_debit = case
    when functional_total_debit = 0 then total_debit
    else functional_total_debit
  end,
  functional_total_credit = case
    when functional_total_credit = 0 then total_credit
    else functional_total_credit
  end,
  updated_at = now();

alter table public.journal_entry_lines
  add column if not exists currency_code text not null default 'UYU',
  add column if not exists fx_rate numeric(18,6) not null default 1,
  add column if not exists functional_debit numeric(18,2) not null default 0,
  add column if not exists functional_credit numeric(18,2) not null default 0;

update public.journal_entry_lines
set
  functional_debit = case
    when functional_debit = 0 then debit
    else functional_debit
  end,
  functional_credit = case
    when functional_credit = 0 then credit
    else functional_credit
  end;

create table if not exists public.ledger_open_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counterparty_type text not null,
  counterparty_id uuid,
  source_document_id uuid not null references public.documents(id) on delete cascade,
  document_role public.document_direction not null default 'other',
  document_type text,
  issue_date date,
  due_date date,
  currency_code text not null default 'UYU',
  fx_rate numeric(18,6) not null default 1,
  fx_rate_date date,
  fx_rate_source text not null default 'same_currency',
  functional_currency_code text not null default 'UYU',
  original_amount numeric(18,2) not null default 0,
  functional_amount numeric(18,2) not null default 0,
  settled_amount numeric(18,2) not null default 0,
  outstanding_amount numeric(18,2) not null default 0,
  status text not null default 'open',
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ledger_open_items_org_counterparty
  on public.ledger_open_items (organization_id, counterparty_type, counterparty_id, status);

create index if not exists idx_ledger_open_items_org_document
  on public.ledger_open_items (organization_id, source_document_id);

create table if not exists public.ledger_settlement_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  open_item_id uuid not null references public.ledger_open_items(id) on delete cascade,
  settlement_document_id uuid not null references public.documents(id) on delete cascade,
  settlement_journal_entry_id uuid references public.journal_entries(id) on delete set null,
  currency_code text not null default 'UYU',
  fx_rate numeric(18,6) not null default 1,
  fx_rate_date date,
  amount numeric(18,2) not null default 0,
  functional_amount numeric(18,2) not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_ledger_settlement_links_org_open_item
  on public.ledger_settlement_links (organization_id, open_item_id, settled_at desc);

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

alter table public.ledger_open_items enable row level security;
alter table public.ledger_settlement_links enable row level security;
alter table public.ai_decision_logs enable row level security;

drop policy if exists "ledger_open_items_select_member" on public.ledger_open_items;
create policy "ledger_open_items_select_member"
on public.ledger_open_items
for select
using (public.is_active_member(organization_id));

drop policy if exists "ledger_open_items_insert_accounting_roles" on public.ledger_open_items;
create policy "ledger_open_items_insert_accounting_roles"
on public.ledger_open_items
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

drop policy if exists "ledger_open_items_update_accounting_roles" on public.ledger_open_items;
create policy "ledger_open_items_update_accounting_roles"
on public.ledger_open_items
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

drop policy if exists "ledger_settlement_links_select_member" on public.ledger_settlement_links;
create policy "ledger_settlement_links_select_member"
on public.ledger_settlement_links
for select
using (public.is_active_member(organization_id));

drop policy if exists "ledger_settlement_links_insert_accounting_roles" on public.ledger_settlement_links;
create policy "ledger_settlement_links_insert_accounting_roles"
on public.ledger_settlement_links
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

drop policy if exists "ai_decision_logs_select_member" on public.ai_decision_logs;
create policy "ai_decision_logs_select_member"
on public.ai_decision_logs
for select
using (public.is_active_member(organization_id));

drop policy if exists "ai_decision_logs_insert_document_roles" on public.ai_decision_logs;
create policy "ai_decision_logs_insert_document_roles"
on public.ai_decision_logs
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
