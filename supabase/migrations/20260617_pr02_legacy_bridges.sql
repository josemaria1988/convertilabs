-- PR-02 Convertilabs 2.0: bridge legacy cost centers/vendors/customers into work_units/parties.

create unique index if not exists idx_work_units_org_legacy_cost_center_unique
  on public.work_units (organization_id, legacy_cost_center_id)
  where legacy_cost_center_id is not null;

insert into public.work_units (
  organization_id,
  name,
  normalized_name,
  kind,
  status,
  description,
  source,
  legacy_cost_center_id,
  metadata_json,
  created_by,
  updated_by,
  archived_at,
  archived_by,
  created_at,
  updated_at
)
select
  cc.organization_id,
  cc.name,
  lower(regexp_replace(cc.name, '\s+', ' ', 'g')),
  'cost_center'::public.work_unit_kind,
  case
    when cc.is_active then 'active'::public.work_unit_status
    else 'archived'::public.work_unit_status
  end,
  cc.description,
  'legacy_cost_center_bridge',
  cc.id,
  coalesce(cc.metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_source_table',
    'organization_cost_centers',
    'legacy_cost_center_id',
    cc.id
  ),
  cc.created_by,
  cc.updated_by,
  cc.archived_at,
  cc.archived_by,
  cc.created_at,
  cc.updated_at
from public.organization_cost_centers as cc
where not exists (
  select 1
  from public.work_units as wu
  where wu.organization_id = cc.organization_id
    and wu.legacy_cost_center_id = cc.id
);

update public.work_units as wu
set
  name = cc.name,
  normalized_name = lower(regexp_replace(cc.name, '\s+', ' ', 'g')),
  status = case
    when cc.is_active then 'active'::public.work_unit_status
    else 'archived'::public.work_unit_status
  end,
  description = cc.description,
  archived_at = cc.archived_at,
  archived_by = cc.archived_by,
  updated_at = greatest(wu.updated_at, cc.updated_at)
from public.organization_cost_centers as cc
where wu.organization_id = cc.organization_id
  and wu.legacy_cost_center_id = cc.id
  and wu.source = 'legacy_cost_center_bridge';

update public.documents as d
set work_unit_id = wu.id
from public.work_units as wu
where d.organization_id = wu.organization_id
  and d.cost_center_id = wu.legacy_cost_center_id
  and d.cost_center_id is not null
  and d.work_unit_id is null;

insert into public.entity_links (
  organization_id,
  source_entity_type,
  source_entity_id,
  target_entity_type,
  target_entity_id,
  relation_type,
  confidence,
  metadata_json
)
select
  d.organization_id,
  'document'::public.entity_type,
  d.id,
  'work_unit'::public.entity_type,
  d.work_unit_id,
  'belongs_to'::public.entity_relation_type,
  1.0000,
  jsonb_build_object(
    'source',
    'legacy_cost_center_bridge',
    'legacy_cost_center_id',
    d.cost_center_id
  )
from public.documents as d
where d.work_unit_id is not null
  and d.cost_center_id is not null
on conflict (
  organization_id,
  source_entity_type,
  source_entity_id,
  target_entity_type,
  target_entity_id,
  relation_type
) do nothing;

insert into public.parties (
  organization_id,
  party_kind,
  legal_name,
  display_name,
  normalized_name,
  tax_id,
  tax_id_normalized,
  legacy_vendor_id,
  source,
  metadata,
  metadata_json,
  created_at,
  updated_at
)
select
  v.organization_id,
  'external',
  v.name,
  v.name,
  coalesce(v.name_normalized, lower(regexp_replace(v.name, '\s+', ' ', 'g'))),
  v.tax_id,
  v.tax_id_normalized,
  v.id,
  'legacy_vendor_bridge',
  coalesce(v.metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_source_table',
    'vendors',
    'legacy_vendor_id',
    v.id
  ),
  coalesce(v.metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_source_table',
    'vendors',
    'legacy_vendor_id',
    v.id
  ),
  v.created_at,
  v.updated_at
from public.vendors as v
where not exists (
  select 1
  from public.parties as p
  where p.organization_id = v.organization_id
    and (
      p.legacy_vendor_id = v.id
      or (
        v.tax_id_normalized is not null
        and p.tax_id_normalized = v.tax_id_normalized
      )
    )
);

update public.parties as p
set
  legacy_vendor_id = v.id,
  metadata_json = coalesce(p.metadata_json, '{}'::jsonb) || jsonb_build_object(
    'legacy_vendor_id',
    v.id
  ),
  updated_at = greatest(p.updated_at, v.updated_at)
from public.vendors as v
where p.organization_id = v.organization_id
  and p.legacy_vendor_id is null
  and v.tax_id_normalized is not null
  and p.tax_id_normalized = v.tax_id_normalized;

insert into public.parties (
  organization_id,
  party_kind,
  legal_name,
  display_name,
  normalized_name,
  tax_id,
  tax_id_normalized,
  legacy_customer_id,
  source,
  metadata,
  metadata_json,
  created_at,
  updated_at
)
select
  c.organization_id,
  'external',
  c.name,
  c.name,
  coalesce(c.name_normalized, lower(regexp_replace(c.name, '\s+', ' ', 'g'))),
  c.tax_id,
  c.tax_id_normalized,
  c.id,
  'legacy_customer_bridge',
  coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_source_table',
    'customers',
    'legacy_customer_id',
    c.id
  ),
  coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_source_table',
    'customers',
    'legacy_customer_id',
    c.id
  ),
  c.created_at,
  c.updated_at
from public.customers as c
where not exists (
  select 1
  from public.parties as p
  where p.organization_id = c.organization_id
    and (
      p.legacy_customer_id = c.id
      or (
        c.tax_id_normalized is not null
        and p.tax_id_normalized = c.tax_id_normalized
      )
    )
);

update public.parties as p
set
  legacy_customer_id = c.id,
  metadata_json = coalesce(p.metadata_json, '{}'::jsonb) || jsonb_build_object(
    'legacy_customer_id',
    c.id
  ),
  updated_at = greatest(p.updated_at, c.updated_at)
from public.customers as c
where p.organization_id = c.organization_id
  and p.legacy_customer_id is null
  and c.tax_id_normalized is not null
  and p.tax_id_normalized = c.tax_id_normalized;

insert into public.party_roles (
  organization_id,
  party_id,
  role_type,
  status,
  metadata_json
)
select
  p.organization_id,
  p.id,
  'vendor'::public.party_role_type,
  'active',
  jsonb_build_object('source', 'legacy_vendor_bridge')
from public.parties as p
where p.legacy_vendor_id is not null
on conflict (organization_id, party_id, role_type) do nothing;

insert into public.party_roles (
  organization_id,
  party_id,
  role_type,
  status,
  metadata_json
)
select
  p.organization_id,
  p.id,
  'customer'::public.party_role_type,
  'active',
  jsonb_build_object('source', 'legacy_customer_bridge')
from public.parties as p
where p.legacy_customer_id is not null
on conflict (organization_id, party_id, role_type) do nothing;

insert into public.party_identifiers (
  organization_id,
  party_id,
  identifier_type,
  identifier_value,
  identifier_value_normalized,
  country_code,
  is_primary,
  source,
  metadata_json
)
select
  p.organization_id,
  p.id,
  'rut'::public.party_identifier_type,
  p.tax_id,
  p.tax_id_normalized,
  coalesce(p.country_code, 'UY'),
  true,
  'legacy_party_bridge',
  jsonb_build_object('source', 'legacy_party_bridge')
from public.parties as p
where p.tax_id_normalized is not null
  and p.tax_id is not null
on conflict (organization_id, identifier_type, identifier_value_normalized) do nothing;

update public.documents as d
set
  vendor_party_id = p.id,
  party_id = coalesce(d.party_id, p.id)
from public.document_invoice_identities as dii
join public.parties as p
  on p.organization_id = dii.organization_id
 and p.legacy_vendor_id = dii.vendor_id
where d.id = dii.document_id
  and d.organization_id = dii.organization_id
  and dii.vendor_id is not null
  and d.vendor_party_id is null;

update public.ledger_open_items as loi
set party_id = p.id
from public.parties as p
where loi.organization_id = p.organization_id
  and loi.counterparty_type = 'vendor'
  and p.legacy_vendor_id = loi.counterparty_id;

update public.ledger_open_items as loi
set party_id = p.id
from public.parties as p
where loi.organization_id = p.organization_id
  and loi.counterparty_type = 'customer'
  and p.legacy_customer_id = loi.counterparty_id;

update public.ledger_open_items as loi
set work_unit_id = d.work_unit_id
from public.documents as d
where loi.organization_id = d.organization_id
  and loi.source_document_id = d.id
  and loi.work_unit_id is null
  and d.work_unit_id is not null;

update public.ledger_settlement_links as lsl
set work_unit_id = loi.work_unit_id
from public.ledger_open_items as loi
where lsl.organization_id = loi.organization_id
  and lsl.open_item_id = loi.id
  and lsl.work_unit_id is null
  and loi.work_unit_id is not null;

update public.journal_entry_lines as jel
set party_id = p.id
from public.parties as p
where jel.vendor_id is not null
  and p.legacy_vendor_id = jel.vendor_id;

update public.journal_entry_lines as jel
set party_id = p.id
from public.parties as p
where jel.customer_id is not null
  and p.legacy_customer_id = jel.customer_id;

update public.journal_entries as je
set work_unit_id = d.work_unit_id
from public.documents as d
where je.organization_id = d.organization_id
  and je.source_document_id = d.id
  and je.work_unit_id is null
  and d.work_unit_id is not null;

update public.posting_proposals as pp
set work_unit_id = d.work_unit_id
from public.source_events as se
join public.documents as d
  on d.id = se.source_document_id
where pp.organization_id = se.organization_id
  and pp.source_event_id = se.id
  and pp.work_unit_id is null
  and d.work_unit_id is not null;
