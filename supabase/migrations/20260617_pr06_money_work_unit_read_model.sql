-- PR-06 Money MVP: expose work unit context in the operational money read model.

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
  loi.work_unit_id,
  wu.name as work_unit_name,
  wu.code as work_unit_code,
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
left join public.work_units as wu
  on wu.id = loi.work_unit_id
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
