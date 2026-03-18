create or replace view public.v_journal_entries_read as
with recursive lineage_walk as (
  select
    je.id as journal_entry_id,
    je.id as ancestor_journal_entry_id,
    coalesce(je.reverses_journal_entry_id, je.adjusts_journal_entry_id) as next_journal_entry_id,
    0 as lineage_depth
  from public.journal_entries as je

  union all

  select
    lineage_walk.journal_entry_id,
    parent.id as ancestor_journal_entry_id,
    coalesce(parent.reverses_journal_entry_id, parent.adjusts_journal_entry_id) as next_journal_entry_id,
    lineage_walk.lineage_depth + 1
  from lineage_walk
  join public.journal_entries as parent
    on parent.id = lineage_walk.next_journal_entry_id
  where lineage_walk.next_journal_entry_id is not null
    and lineage_walk.lineage_depth < 32
),
lineage_root as (
  select distinct on (lineage_walk.journal_entry_id)
    lineage_walk.journal_entry_id,
    lineage_walk.ancestor_journal_entry_id as lineage_root_journal_entry_id,
    lineage_walk.lineage_depth
  from lineage_walk
  order by lineage_walk.journal_entry_id, lineage_walk.lineage_depth desc
),
line_summary as (
  select
    jel.journal_entry_id,
    count(*)::integer as line_count,
    count(distinct jel.account_id)::integer as distinct_account_count
  from public.journal_entry_lines as jel
  group by jel.journal_entry_id
),
open_item_summary as (
  select
    loi.journal_entry_id,
    count(*)::integer as open_item_count,
    round(coalesce(sum(loi.outstanding_amount), 0), 2) as open_item_outstanding_amount,
    round(coalesce(sum(loi.functional_amount), 0), 2) as open_item_functional_amount
  from public.ledger_open_items as loi
  where loi.journal_entry_id is not null
  group by loi.journal_entry_id
),
settlement_summary as (
  select
    lsl.settlement_journal_entry_id as journal_entry_id,
    count(*)::integer as settlement_link_count,
    round(coalesce(sum(lsl.amount), 0), 2) as settlement_amount,
    round(coalesce(sum(lsl.functional_amount), 0), 2) as settlement_functional_amount,
    max(lsl.settled_at) as last_settled_at
  from public.ledger_settlement_links as lsl
  where lsl.settlement_journal_entry_id is not null
  group by lsl.settlement_journal_entry_id
)
select
  je.organization_id,
  je.id as journal_entry_id,
  je.entry_number,
  je.entry_date,
  je.status,
  je.posting_mode,
  je.source_channel,
  je.source_system,
  je.source_provider,
  je.provider_managed,
  je.source_document_id,
  je.source_event_id,
  se.source_entity_type,
  se.source_entity_id,
  se.source_external_id,
  je.posting_proposal_id,
  pp.confirmability_status as posting_proposal_confirmability_status,
  pp.accounting_snapshot_fingerprint,
  je.accounting_snapshot_id,
  je.fiscal_period_id,
  fp.code as fiscal_period_code,
  fp.label as fiscal_period_label,
  fp.status as fiscal_period_status,
  je.journal_type_id,
  jt.code as journal_type_code,
  jt.name as journal_type_name,
  je.auxiliary_book_id,
  ab.code as auxiliary_book_code,
  ab.name as auxiliary_book_name,
  je.reference,
  je.description,
  je.currency_code,
  je.functional_currency_code,
  je.fx_rate,
  je.fx_rate_date,
  je.fx_rate_source,
  je.total_debit,
  je.total_credit,
  je.functional_total_debit,
  je.functional_total_credit,
  je.source_hash,
  je.economic_hash,
  coalesce(line_summary.line_count, 0) as line_count,
  coalesce(line_summary.distinct_account_count, 0) as distinct_account_count,
  coalesce(open_item_summary.open_item_count, 0) as open_item_count,
  coalesce(open_item_summary.open_item_outstanding_amount, 0)::numeric(18,2) as open_item_outstanding_amount,
  coalesce(open_item_summary.open_item_functional_amount, 0)::numeric(18,2) as open_item_functional_amount,
  coalesce(settlement_summary.settlement_link_count, 0) as settlement_link_count,
  coalesce(settlement_summary.settlement_amount, 0)::numeric(18,2) as settlement_amount,
  coalesce(settlement_summary.settlement_functional_amount, 0)::numeric(18,2) as settlement_functional_amount,
  settlement_summary.last_settled_at,
  case
    when je.reverses_journal_entry_id is not null then 'reversal'
    when je.adjusts_journal_entry_id is not null then 'adjustment'
    else 'base'
  end as lineage_kind,
  lineage_root.lineage_root_journal_entry_id,
  coalesce(lineage_root.lineage_depth, 0) as lineage_depth,
  je.reverses_journal_entry_id,
  je.reversed_by_journal_entry_id,
  je.adjusts_journal_entry_id,
  je.annulment_reason,
  je.immutable_at is not null as is_immutable,
  je.reversed_by_journal_entry_id is null as is_active_leaf,
  je.first_seen_at,
  je.last_seen_at,
  je.created_at,
  je.updated_at
from public.journal_entries as je
left join public.source_events as se
  on se.id = je.source_event_id
left join public.posting_proposals as pp
  on pp.id = je.posting_proposal_id
left join public.fiscal_periods as fp
  on fp.id = je.fiscal_period_id
left join public.journal_types as jt
  on jt.id = je.journal_type_id
left join public.auxiliary_books as ab
  on ab.id = je.auxiliary_book_id
left join line_summary
  on line_summary.journal_entry_id = je.id
left join open_item_summary
  on open_item_summary.journal_entry_id = je.id
left join settlement_summary
  on settlement_summary.journal_entry_id = je.id
left join lineage_root
  on lineage_root.journal_entry_id = je.id;

alter view public.v_journal_entries_read set (security_invoker = true);

create or replace view public.v_journal_lineage as
with relations as (
  select
    je.organization_id,
    je.id as journal_entry_id,
    je.reverses_journal_entry_id as related_journal_entry_id,
    'reverses'::text as relation_type
  from public.journal_entries as je
  where je.reverses_journal_entry_id is not null

  union all

  select
    je.organization_id,
    je.id as journal_entry_id,
    je.reversed_by_journal_entry_id as related_journal_entry_id,
    'reversed_by'::text as relation_type
  from public.journal_entries as je
  where je.reversed_by_journal_entry_id is not null

  union all

  select
    je.organization_id,
    je.id as journal_entry_id,
    je.adjusts_journal_entry_id as related_journal_entry_id,
    'adjusts'::text as relation_type
  from public.journal_entries as je
  where je.adjusts_journal_entry_id is not null
)
select
  relations.organization_id,
  relations.journal_entry_id,
  current_entry.entry_number,
  current_entry.entry_date,
  current_entry.status as entry_status,
  current_entry.lineage_root_journal_entry_id,
  relations.related_journal_entry_id,
  related_entry.entry_number as related_entry_number,
  related_entry.entry_date as related_entry_date,
  related_entry.status as related_entry_status,
  related_entry.lineage_root_journal_entry_id as related_lineage_root_journal_entry_id,
  relations.relation_type
from relations
join public.v_journal_entries_read as current_entry
  on current_entry.journal_entry_id = relations.journal_entry_id
left join public.v_journal_entries_read as related_entry
  on related_entry.journal_entry_id = relations.related_journal_entry_id;

alter view public.v_journal_lineage set (security_invoker = true);

create or replace view public.v_trial_balance as
select
  je.organization_id,
  je.fiscal_period_id,
  fp.code as fiscal_period_code,
  fp.label as fiscal_period_label,
  je.source_channel,
  jel.account_id,
  coa.code as account_code,
  coa.name as account_name,
  coa.account_type,
  coa.chapter_code,
  coa.presentation_code,
  coa.statement_section,
  coalesce(coa.natural_balance, coa.normal_side) as natural_balance,
  round(coalesce(sum(jel.debit), 0), 2) as debit,
  round(coalesce(sum(jel.credit), 0), 2) as credit,
  round(coalesce(sum(jel.debit - jel.credit), 0), 2) as balance,
  round(coalesce(sum(coalesce(jel.functional_debit, jel.debit)), 0), 2) as functional_debit,
  round(coalesce(sum(coalesce(jel.functional_credit, jel.credit)), 0), 2) as functional_credit,
  round(
    coalesce(
      sum(coalesce(jel.functional_debit, jel.debit) - coalesce(jel.functional_credit, jel.credit)),
      0
    ),
    2
  ) as functional_balance,
  count(distinct je.id)::integer as entry_count,
  count(*)::integer as line_count,
  min(je.entry_date) as first_entry_date,
  max(je.entry_date) as last_entry_date
from public.journal_entries as je
join public.journal_entry_lines as jel
  on jel.journal_entry_id = je.id
left join public.chart_of_accounts as coa
  on coa.id = jel.account_id
left join public.fiscal_periods as fp
  on fp.id = je.fiscal_period_id
where je.status in ('posted', 'exported')
  and je.immutable_at is not null
group by
  je.organization_id,
  je.fiscal_period_id,
  fp.code,
  fp.label,
  je.source_channel,
  jel.account_id,
  coa.code,
  coa.name,
  coa.account_type,
  coa.chapter_code,
  coa.presentation_code,
  coa.statement_section,
  coalesce(coa.natural_balance, coa.normal_side);

alter view public.v_trial_balance set (security_invoker = true);

create or replace view public.v_open_items_outstanding as
with settlement_summary as (
  select
    lsl.open_item_id,
    count(*)::integer as settlement_count,
    round(coalesce(sum(lsl.amount), 0), 2) as settled_amount_linked,
    round(coalesce(sum(lsl.functional_amount), 0), 2) as settled_functional_amount_linked,
    max(lsl.settled_at) as last_settled_at
  from public.ledger_settlement_links as lsl
  group by lsl.open_item_id
)
select
  loi.organization_id,
  loi.id as open_item_id,
  loi.party_id,
  loi.counterparty_type,
  loi.counterparty_id,
  coalesce(p.display_name, p.legal_name, v.name, c.name) as counterparty_name,
  coalesce(p.tax_id_normalized, v.tax_id_normalized, c.tax_id_normalized) as counterparty_tax_id_normalized,
  loi.source_channel,
  loi.source_entity_type,
  loi.source_entity_id,
  loi.source_document_id,
  loi.document_role,
  loi.document_type,
  loi.issue_date,
  loi.due_date,
  case
    when loi.due_date is not null
      and loi.due_date < current_date
      and loi.outstanding_amount > 0
      then (current_date - loi.due_date)
    else 0
  end as days_overdue,
  loi.currency_code,
  loi.original_currency_code,
  loi.functional_currency_code,
  loi.fx_rate,
  loi.fx_rate_date,
  loi.fx_rate_source,
  loi.original_amount,
  loi.functional_amount,
  loi.settled_amount,
  loi.outstanding_amount,
  loi.status,
  loi.journal_entry_id as opening_journal_entry_id,
  opening_entry.entry_number as opening_entry_number,
  opening_entry.entry_date as opening_entry_date,
  loi.opening_journal_entry_line_id,
  coalesce(settlement_summary.settlement_count, 0) as settlement_count,
  coalesce(settlement_summary.settled_amount_linked, 0)::numeric(18,2) as settled_amount_linked,
  coalesce(settlement_summary.settled_functional_amount_linked, 0)::numeric(18,2) as settled_functional_amount_linked,
  settlement_summary.last_settled_at,
  coalesce((loi.metadata ->> 'residual_credit_balance')::boolean, false) as is_residual_credit_balance,
  loi.provider_managed,
  loi.source_hash,
  loi.created_at,
  loi.updated_at
from public.ledger_open_items as loi
left join public.parties as p
  on p.id = loi.party_id
left join public.vendors as v
  on loi.counterparty_type = 'vendor'
 and v.id = loi.counterparty_id
left join public.customers as c
  on loi.counterparty_type = 'customer'
 and c.id = loi.counterparty_id
left join public.journal_entries as opening_entry
  on opening_entry.id = loi.journal_entry_id
left join settlement_summary
  on settlement_summary.open_item_id = loi.id
where abs(coalesce(loi.outstanding_amount, 0)) > 0.009;

alter view public.v_open_items_outstanding set (security_invoker = true);

create or replace view public.v_balance_sheet as
select
  tb.organization_id,
  tb.fiscal_period_id,
  tb.fiscal_period_code,
  tb.fiscal_period_label,
  tb.account_id,
  tb.account_code,
  tb.account_name,
  tb.account_type,
  tb.chapter_code,
  tb.presentation_code,
  tb.statement_section,
  tb.natural_balance,
  case
    when tb.account_type = 'asset' then 'asset'
    when tb.account_type = 'liability' then 'liability'
    when tb.account_type = 'equity' then 'equity'
    else 'other'
  end as report_section,
  case
    when tb.account_type = 'asset' then tb.functional_balance
    else -1 * tb.functional_balance
  end as presentation_balance,
  tb.functional_balance as raw_functional_balance,
  case
    when tb.natural_balance = 'debit' then tb.functional_balance < 0
    when tb.natural_balance = 'credit' then tb.functional_balance > 0
    else false
  end as has_abnormal_balance
from public.v_trial_balance as tb
where tb.account_type in ('asset', 'liability', 'equity');

alter view public.v_balance_sheet set (security_invoker = true);

create or replace view public.v_income_statement as
select
  tb.organization_id,
  tb.fiscal_period_id,
  tb.fiscal_period_code,
  tb.fiscal_period_label,
  tb.account_id,
  tb.account_code,
  tb.account_name,
  tb.account_type,
  tb.chapter_code,
  tb.presentation_code,
  tb.statement_section,
  tb.natural_balance,
  case
    when tb.account_type = 'revenue' then 'revenue'
    when tb.account_type = 'expense' then 'expense'
    else 'other'
  end as report_section,
  case
    when tb.account_type = 'revenue' then -1 * tb.functional_balance
    else tb.functional_balance
  end as presentation_balance,
  tb.functional_balance as raw_functional_balance,
  case
    when tb.natural_balance = 'debit' then tb.functional_balance < 0
    when tb.natural_balance = 'credit' then tb.functional_balance > 0
    else false
  end as has_abnormal_balance
from public.v_trial_balance as tb
where tb.account_type in ('revenue', 'expense');

alter view public.v_income_statement set (security_invoker = true);
