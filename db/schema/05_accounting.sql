create table if not exists public.accounting_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope text not null,
  document_id uuid references public.documents(id) on delete cascade,
  source_document_id uuid references public.documents(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  concept_id uuid references public.organization_concepts(id) on delete cascade,
  document_role public.document_direction not null default 'purchase',
  account_id uuid not null references public.chart_of_accounts(id),
  vat_profile_json jsonb not null default '{}'::jsonb,
  tax_profile_code text,
  operation_category text,
  linked_operation_type text,
  template_code text,
  status public.accounting_rule_status not null default 'approved',
  times_reused integer not null default 0,
  times_corrected integer not null default 0,
  priority integer not null default 0,
  source text not null default 'manual',
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounting_rules_org_scope_active
  on public.accounting_rules (organization_id, scope, is_active, priority desc);

create index if not exists idx_accounting_rules_org_status_scope
  on public.accounting_rules (organization_id, status, scope, is_active, priority desc);

create index if not exists idx_accounting_rules_org_vendor_concept
  on public.accounting_rules (organization_id, vendor_id, concept_id, document_role);

create table if not exists public.accounting_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  extraction_id uuid references public.document_extractions(id) on delete set null,
  version_no integer not null,
  status public.suggestion_status not null default 'drafted',
  confidence numeric(5,4),
  explanation text,
  tax_treatment_json jsonb not null default '{}'::jsonb,
  rule_trace_json jsonb not null default '[]'::jsonb,
  generated_by text not null default 'system',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, version_no)
);

create index if not exists idx_accounting_suggestions_org_doc
  on public.accounting_suggestions (organization_id, document_id);

create table if not exists public.accounting_suggestion_lines (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.accounting_suggestions(id) on delete cascade,
  line_no integer not null,
  side public.normal_side not null,
  account_id uuid not null references public.chart_of_accounts(id),
  amount numeric(18,2) not null,
  tax_tag text,
  memo text,
  metadata jsonb not null default '{}'::jsonb,
  unique (suggestion_id, line_no)
);

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

alter table public.source_event_facts
  add column if not exists economic_hash text;

create index if not exists idx_source_event_facts_org_event
  on public.source_event_facts (organization_id, source_event_id, version_no desc);

update public.source_event_facts
set economic_hash = coalesce(economic_hash, payload_hash)
where economic_hash is null;

create table if not exists public.posting_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_event_id uuid not null references public.source_events(id) on delete cascade,
  source_event_facts_id uuid not null references public.source_event_facts(id) on delete cascade,
  source_event_facts_version_no integer not null,
  accounting_snapshot_id uuid references public.organization_accounting_snapshots(id) on delete set null,
  accounting_snapshot_fingerprint text,
  proposal_version_no integer not null,
  status text not null default 'draft',
  posting_mode public.journal_posting_mode not null default 'final',
  proposal_hash text not null,
  economic_hash text,
  confirmability_status text not null default 'confirmable',
  explanation text,
  journal_preview_json jsonb not null default '{}'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  blockers_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  invalidated_at timestamptz,
  invalidated_reason text,
  materialized_journal_entry_id uuid,
  created_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_event_id, proposal_version_no)
);

alter table public.posting_proposals
  add column if not exists accounting_snapshot_fingerprint text,
  add column if not exists economic_hash text,
  add column if not exists confirmability_status text not null default 'confirmable',
  add column if not exists invalidated_at timestamptz,
  add column if not exists invalidated_reason text,
  add column if not exists materialized_journal_entry_id uuid;

create index if not exists idx_posting_proposals_org_event
  on public.posting_proposals (organization_id, source_event_id, proposal_version_no desc);

create index if not exists idx_posting_proposals_org_confirmability
  on public.posting_proposals (organization_id, confirmability_status, created_at desc);

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

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid references public.documents(id) on delete set null,
  source_suggestion_id uuid references public.accounting_suggestions(id) on delete set null,
  entry_date date not null,
  period_id uuid,
  status public.entry_status not null default 'draft',
  posting_mode public.journal_posting_mode not null default 'final',
  currency_code text not null default 'UYU',
  fx_rate numeric(18,6) not null default 1,
  fx_rate_date date,
  fx_rate_source text not null default 'same_currency',
  fx_rate_bcu_value numeric(18,6),
  fx_rate_bcu_date_used date,
  functional_currency_code text not null default 'UYU',
  functional_currency text not null default 'UYU',
  source_currency_present boolean not null default false,
  reference text,
  description text,
  total_debit numeric(18,2) not null default 0,
  total_credit numeric(18,2) not null default 0,
  functional_total_debit numeric(18,2) not null default 0,
  functional_total_credit numeric(18,2) not null default 0,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  add column if not exists economic_hash text,
  add column if not exists entry_number bigint,
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
  economic_hash = coalesce(economic_hash, source_hash),
  first_seen_at = coalesce(first_seen_at, created_at, now()),
  last_seen_at = coalesce(last_seen_at, updated_at, created_at, now()),
  legacy_immutable = coalesce(legacy_immutable, false)
where true;

with existing_max as (
  select
    organization_id,
    coalesce(max(entry_number), 0) as max_entry_number
  from public.journal_entries
  group by organization_id
),
numbered_entries as (
  select
    je.id,
    coalesce(existing_max.max_entry_number, 0)
    + row_number() over (
      partition by je.organization_id
      order by je.created_at asc, je.id asc
    ) as generated_entry_number
  from public.journal_entries as je
  left join existing_max
    on existing_max.organization_id = je.organization_id
  where je.entry_number is null
    and je.status in ('posted', 'exported')
)
update public.journal_entries as je
set entry_number = numbered_entries.generated_entry_number
from numbered_entries
where numbered_entries.id = je.id;

create index if not exists idx_journal_entries_org_date
  on public.journal_entries (organization_id, entry_date);

create index if not exists idx_journal_entries_org_source_event
  on public.journal_entries (organization_id, source_event_id, created_at desc);

create unique index if not exists idx_journal_entries_org_entry_number
  on public.journal_entries (organization_id, entry_number)
  where entry_number is not null;

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  line_no integer not null,
  account_id uuid not null references public.chart_of_accounts(id),
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  currency_code text not null default 'UYU',
  original_currency_code text,
  original_amount numeric(18,2),
  fx_rate numeric(18,6) not null default 1,
  fx_rate_applied numeric(18,6),
  functional_debit numeric(18,2) not null default 0,
  functional_credit numeric(18,2) not null default 0,
  functional_amount_uyu numeric(18,2),
  tax_tag text,
  vendor_id uuid references public.vendors(id),
  customer_id uuid references public.customers(id),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  unique (journal_entry_id, line_no)
);

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

alter table public.posting_proposals
  drop constraint if exists posting_proposals_materialized_journal_entry_id_fkey;

alter table public.posting_proposals
  add constraint posting_proposals_materialized_journal_entry_id_fkey
    foreign key (materialized_journal_entry_id)
    references public.journal_entries(id)
    on delete set null;

update public.posting_proposals as pp
set
  accounting_snapshot_fingerprint = coalesce(
    pp.accounting_snapshot_fingerprint,
    nullif(pp.metadata_json ->> 'accounting_snapshot_fingerprint', '')
  ),
  economic_hash = coalesce(
    pp.economic_hash,
    nullif(pp.metadata_json ->> 'economic_hash', ''),
    pp.proposal_hash
  ),
  materialized_journal_entry_id = coalesce(
    pp.materialized_journal_entry_id,
    (
      select je.id
      from public.journal_entries as je
      where je.posting_proposal_id = pp.id
      order by je.created_at desc, je.id desc
      limit 1
    )
  ),
  confirmability_status = case
    when exists (
      select 1
      from public.journal_entries as je
      where je.posting_proposal_id = pp.id
    ) then 'materialized'
    when coalesce(nullif(pp.confirmability_status, ''), 'confirmable') = 'materialized'
      and not exists (
        select 1
        from public.journal_entries as je
        where je.posting_proposal_id = pp.id
      ) then 'confirmable'
    else coalesce(nullif(pp.confirmability_status, ''), 'confirmable')
  end
where true;

create index if not exists idx_posting_proposals_materialized_journal
  on public.posting_proposals (materialized_journal_entry_id)
  where materialized_journal_entry_id is not null;

create or replace function public.finalize_journal_entry()
returns trigger
language plpgsql
as $$
declare
  period_record record;
  locked_before date;
  line_totals record;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.immutable_at is null and new.immutable_at is not null then
    if new.status not in ('posted', 'exported') then
      raise exception 'No se puede finalizar un asiento sin status posted/exported.';
    end if;

    if new.fiscal_period_id is null then
      raise exception 'No se puede finalizar un asiento sin fiscal_period_id.';
    end if;

    select id, starts_on, ends_on, status, locked_at
    into period_record
    from public.fiscal_periods
    where id = new.fiscal_period_id;

    if period_record.id is null then
      raise exception 'No existe el periodo contable asociado al asiento.';
    end if;

    if new.entry_date < period_record.starts_on or new.entry_date > period_record.ends_on then
      raise exception 'La fecha del asiento queda fuera del periodo contable seleccionado.';
    end if;

    if period_record.status in ('closed', 'locked') or period_record.locked_at is not null then
      raise exception 'No se puede finalizar un asiento en un periodo cerrado o bloqueado.';
    end if;

    select modifications_locked_before
    into locked_before
    from public.accounting_settings
    where organization_id = new.organization_id
    limit 1;

    if locked_before is not null and new.entry_date <= locked_before then
      raise exception 'La fecha del asiento cae antes del lock contable configurado.';
    end if;

    select
      count(*) as line_count,
      coalesce(sum(debit), 0)::numeric(18,2) as total_debit,
      coalesce(sum(credit), 0)::numeric(18,2) as total_credit,
      coalesce(sum(functional_debit), 0)::numeric(18,2) as functional_total_debit,
      coalesce(sum(functional_credit), 0)::numeric(18,2) as functional_total_credit
    into line_totals
    from public.journal_entry_lines
    where journal_entry_id = new.id;

    if coalesce(line_totals.line_count, 0) = 0 then
      raise exception 'No se puede finalizar un asiento sin lineas.';
    end if;

    if abs(coalesce(line_totals.total_debit, 0) - coalesce(line_totals.total_credit, 0)) > 0.01 then
      raise exception 'Debe y Haber no cuadran al finalizar el asiento.';
    end if;

    if abs(
      coalesce(line_totals.functional_total_debit, 0)
      - coalesce(line_totals.functional_total_credit, 0)
    ) > 0.01 then
      raise exception 'Los montos funcionales no cuadran al finalizar el asiento.';
    end if;

    if abs(coalesce(new.total_debit, 0) - coalesce(line_totals.total_debit, 0)) > 0.01
      or abs(coalesce(new.total_credit, 0) - coalesce(line_totals.total_credit, 0)) > 0.01
      or abs(
        coalesce(new.functional_total_debit, 0)
        - coalesce(line_totals.functional_total_debit, 0)
      ) > 0.01
      or abs(
        coalesce(new.functional_total_credit, 0)
        - coalesce(line_totals.functional_total_credit, 0)
      ) > 0.01 then
      raise exception 'Los totales del encabezado no coinciden con las lineas del asiento.';
    end if;

    new.total_debit := line_totals.total_debit;
    new.total_credit := line_totals.total_credit;
    new.functional_total_debit := line_totals.functional_total_debit;
    new.functional_total_credit := line_totals.functional_total_credit;
    new.immutable_at := coalesce(new.immutable_at, now());

    if new.entry_number is null then
      perform pg_advisory_xact_lock(hashtext(new.organization_id::text));

      select coalesce(max(entry_number), 0) + 1
      into new.entry_number
      from public.journal_entries
      where organization_id = new.organization_id
        and id <> new.id;
    end if;
  elsif new.status in ('posted', 'exported') and new.immutable_at is null then
    raise exception 'No se puede dejar un asiento posted/exported sin immutable_at.';
  end if;

  return new;
end;
$$;

create or replace function public.guard_immutable_journal_entry()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.immutable_at is not null then
      raise exception 'No se puede borrar un asiento inmutable.';
    end if;

    return old;
  end if;

  if old.immutable_at is not null then
    if new.immutable_at is distinct from old.immutable_at then
      raise exception 'No se puede modificar immutable_at de un asiento inmutable.';
    end if;

    if new.status is distinct from old.status
      and not (old.status = 'posted' and new.status = 'exported') then
      raise exception 'Un asiento inmutable solo puede cambiar de posted a exported.';
    end if;

    if (
      to_jsonb(new) - '{reversed_by_journal_entry_id,annulment_reason,status,updated_at,last_seen_at}'::text[]
    ) is distinct from (
      to_jsonb(old) - '{reversed_by_journal_entry_id,annulment_reason,status,updated_at,last_seen_at}'::text[]
    ) then
      raise exception 'No se puede modificar un asiento inmutable fuera de reversal/export metadata.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_immutable_journal_entry_line()
returns trigger
language plpgsql
as $$
declare
  parent_immutable_at timestamptz;
begin
  select immutable_at
  into parent_immutable_at
  from public.journal_entries
  where id = case
    when tg_op = 'DELETE' then old.journal_entry_id
    else new.journal_entry_id
  end;

  if parent_immutable_at is not null then
    raise exception 'No se pueden mutar lineas de un asiento inmutable.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_finalize_journal_entry on public.journal_entries;
create trigger trg_finalize_journal_entry
before update on public.journal_entries
for each row
execute function public.finalize_journal_entry();

drop trigger if exists trg_guard_immutable_journal_entry on public.journal_entries;
create trigger trg_guard_immutable_journal_entry
before update or delete on public.journal_entries
for each row
execute function public.guard_immutable_journal_entry();

drop trigger if exists trg_guard_immutable_journal_entry_line on public.journal_entry_lines;
create trigger trg_guard_immutable_journal_entry_line
before insert or update or delete on public.journal_entry_lines
for each row
execute function public.guard_immutable_journal_entry_line();

create table if not exists public.ledger_open_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counterparty_type text not null,
  counterparty_id uuid,
  source_document_id uuid references public.documents(id) on delete cascade,
  document_role public.document_direction not null default 'other',
  document_type text,
  issue_date date,
  due_date date,
  currency_code text not null default 'UYU',
  original_currency_code text,
  fx_rate numeric(18,6) not null default 1,
  fx_rate_date date,
  fx_rate_source text not null default 'same_currency',
  fx_rate_origin numeric(18,6),
  fx_rate_origin_date date,
  functional_currency_code text not null default 'UYU',
  original_amount numeric(18,2) not null default 0,
  functional_amount numeric(18,2) not null default 0,
  functional_amount_origin_uyu numeric(18,2),
  settled_amount numeric(18,2) not null default 0,
  outstanding_amount numeric(18,2) not null default 0,
  status text not null default 'open',
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

alter table public.ledger_settlement_links
  add column if not exists settlement_journal_entry_line_id uuid references public.journal_entry_lines(id) on delete set null,
  add column if not exists source_channel text not null default 'documents',
  add column if not exists source_entity_type text,
  add column if not exists source_entity_id uuid,
  add column if not exists source_ref_json jsonb not null default '{}'::jsonb;

create index if not exists idx_ledger_settlement_links_org_open_item
  on public.ledger_settlement_links (organization_id, open_item_id, settled_at desc);
