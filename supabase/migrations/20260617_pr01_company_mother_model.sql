-- PR-01 Convertilabs 2.0: company mother model for directory, work and events.
-- Safe for existing databases. For a destructive clean rebuild, use supabase/reset/ first.

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'party_role_type') then
    create type public.party_role_type as enum (
      'customer',
      'vendor',
      'bank',
      'institution',
      'accountant',
      'employee',
      'partner',
      'transport',
      'internal',
      'other'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'party_identifier_type') then
    create type public.party_identifier_type as enum (
      'rut',
      'tax_id',
      'email',
      'phone',
      'zeta_contact_code',
      'zeta_customer_code',
      'zeta_supplier_code',
      'external_code',
      'other'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'work_unit_kind') then
    create type public.work_unit_kind as enum (
      'job',
      'project',
      'operation',
      'department',
      'internal_cost_center',
      'service',
      'maintenance',
      'administration',
      'cost_center',
      'area'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'work_unit_status') then
    create type public.work_unit_status as enum (
      'planned',
      'active',
      'paused',
      'blocked',
      'completed',
      'cancelled',
      'archived'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'business_event_type') then
    create type public.business_event_type as enum (
      'work_unit_created',
      'work_unit_started',
      'work_unit_completed',
      'purchase_document_received',
      'sales_document_issued',
      'document_received',
      'document_issued',
      'payment_made',
      'collection_received',
      'tax_obligation_due',
      'process_run_started',
      'process_run_blocked',
      'client_contacted',
      'supplier_contacted',
      'document_posted',
      'vat_run_generated',
      'administrative_decision_recorded',
      'other'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'entity_type') then
    create type public.entity_type as enum (
      'organization',
      'profile',
      'party',
      'contact',
      'work_unit',
      'document',
      'business_event',
      'task',
      'process',
      'process_run',
      'open_item',
      'payment',
      'collection',
      'journal_entry',
      'tax_period',
      'vat_run',
      'integration_raw_record',
      'source_event',
      'evidence_ref',
      'assistant_run',
      'assistant_message',
      'audit_log',
      'other'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'entity_relation_type') then
    create type public.entity_relation_type as enum (
      'belongs_to',
      'involves',
      'issued_by',
      'received_from',
      'assigned_to',
      'blocks',
      'generated',
      'settles',
      'evidences',
      'discusses',
      'affects',
      'derived_from',
      'supersedes',
      'related_to'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'evidence_ref_type') then
    create type public.evidence_ref_type as enum (
      'document',
      'storage_object',
      'integration_raw_record',
      'source_event',
      'audit_log',
      'ai_decision_log',
      'assistant_run',
      'assistant_message',
      'note',
      'url',
      'external_reference',
      'journal_entry',
      'other'
    );
  end if;
end
$$;

alter table public.parties
  add column if not exists normalized_name text,
  add column if not exists country_code text,
  add column if not exists default_currency_code text references public.currencies(code),
  add column if not exists status text not null default 'active',
  add column if not exists source text not null default 'manual',
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

update public.parties
set
  display_name = coalesce(nullif(trim(display_name), ''), nullif(trim(legal_name), ''), 'Party sin nombre'),
  normalized_name = coalesce(
    normalized_name,
    lower(regexp_replace(coalesce(nullif(display_name, ''), nullif(legal_name, ''), ''), '\s+', ' ', 'g'))
  ),
  country_code = coalesce(nullif(country_code, ''), 'UY'),
  status = coalesce(nullif(status, ''), 'active'),
  metadata_json = coalesce(nullif(metadata_json, '{}'::jsonb), metadata, '{}'::jsonb)
where true;

alter table public.parties
  alter column display_name set not null,
  alter column legal_name drop not null;

create index if not exists idx_parties_org_status_name
  on public.parties (organization_id, status, normalized_name);

create index if not exists idx_parties_org_source
  on public.parties (organization_id, source, created_at desc);

create table if not exists public.party_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  party_id uuid not null references public.parties(id) on delete cascade,
  role_type public.party_role_type not null,
  status text not null default 'active',
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, party_id, role_type)
);

create index if not exists idx_party_roles_org_role_status
  on public.party_roles (organization_id, role_type, status);

create table if not exists public.party_identifiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  party_id uuid not null references public.parties(id) on delete cascade,
  identifier_type public.party_identifier_type not null,
  identifier_value text not null,
  identifier_value_normalized text not null,
  country_code text,
  is_primary boolean not null default false,
  source text not null default 'manual',
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_party_identifiers_org_type_value
  on public.party_identifiers (organization_id, identifier_type, identifier_value_normalized);

create index if not exists idx_party_identifiers_party
  on public.party_identifiers (party_id, identifier_type, is_primary desc);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  normalized_name text,
  email text,
  email_normalized text,
  phone text,
  mobile text,
  notes text,
  status text not null default 'active',
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contacts_org_name
  on public.contacts (organization_id, normalized_name);

create index if not exists idx_contacts_org_email
  on public.contacts (organization_id, email_normalized)
  where email_normalized is not null;

create table if not exists public.party_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  party_id uuid not null references public.parties(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  relationship_label text,
  is_primary boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, party_id, contact_id)
);

create index if not exists idx_party_contacts_contact
  on public.party_contacts (organization_id, contact_id);

create table if not exists public.work_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null,
  normalized_name text,
  kind public.work_unit_kind not null default 'job',
  status public.work_unit_status not null default 'planned',
  customer_party_id uuid references public.parties(id) on delete set null,
  owner_member_id uuid references public.organization_members(id) on delete set null,
  start_date date,
  end_date date,
  estimated_revenue numeric(18,2),
  estimated_cost numeric(18,2),
  actual_revenue numeric(18,2) not null default 0,
  actual_cost numeric(18,2) not null default 0,
  margin_status text,
  currency_code text references public.currencies(code),
  description text,
  source text not null default 'manual',
  legacy_cost_center_id uuid references public.organization_cost_centers(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_work_units_org_status_kind
  on public.work_units (organization_id, status, kind, updated_at desc);

create index if not exists idx_work_units_org_customer
  on public.work_units (organization_id, customer_party_id, status)
  where customer_party_id is not null;

create index if not exists idx_work_units_legacy_cost_center
  on public.work_units (organization_id, legacy_cost_center_id)
  where legacy_cost_center_id is not null;

alter table public.documents
  add column if not exists party_id uuid references public.parties(id) on delete set null,
  add column if not exists vendor_party_id uuid references public.parties(id) on delete set null,
  add column if not exists customer_party_id uuid references public.parties(id) on delete set null,
  add column if not exists work_unit_id uuid references public.work_units(id) on delete set null;

create index if not exists idx_documents_org_party
  on public.documents (organization_id, party_id, created_at desc)
  where party_id is not null;

create index if not exists idx_documents_org_work_unit
  on public.documents (organization_id, work_unit_id, created_at desc)
  where work_unit_id is not null;

alter table public.posting_proposals
  add column if not exists party_id uuid references public.parties(id) on delete set null,
  add column if not exists work_unit_id uuid references public.work_units(id) on delete set null;

create index if not exists idx_posting_proposals_org_party_work_unit
  on public.posting_proposals (organization_id, party_id, work_unit_id, created_at desc);

alter table public.posting_proposal_lines
  add column if not exists work_unit_id uuid references public.work_units(id) on delete set null;

alter table public.journal_entries
  add column if not exists party_id uuid references public.parties(id) on delete set null,
  add column if not exists work_unit_id uuid references public.work_units(id) on delete set null;

create index if not exists idx_journal_entries_org_party_work_unit
  on public.journal_entries (organization_id, party_id, work_unit_id, entry_date desc);

alter table public.journal_entry_lines
  add column if not exists work_unit_id uuid references public.work_units(id) on delete set null;

create index if not exists idx_journal_entry_lines_work_unit
  on public.journal_entry_lines (work_unit_id)
  where work_unit_id is not null;

alter table public.ledger_open_items
  add column if not exists work_unit_id uuid references public.work_units(id) on delete set null;

create index if not exists idx_ledger_open_items_org_party_work_unit
  on public.ledger_open_items (organization_id, party_id, work_unit_id, status);

alter table public.ledger_settlement_links
  add column if not exists work_unit_id uuid references public.work_units(id) on delete set null;

create table if not exists public.business_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type public.business_event_type not null,
  event_date date,
  occurred_at timestamptz not null default now(),
  summary text,
  status text not null default 'recorded',
  source_entity_type public.entity_type,
  source_entity_id uuid,
  party_id uuid references public.parties(id) on delete set null,
  work_unit_id uuid references public.work_units(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  actor_member_id uuid references public.organization_members(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_events_org_occurred
  on public.business_events (organization_id, occurred_at desc);

create index if not exists idx_business_events_org_type
  on public.business_events (organization_id, event_type, occurred_at desc);

create index if not exists idx_business_events_org_work_unit
  on public.business_events (organization_id, work_unit_id, occurred_at desc)
  where work_unit_id is not null;

create table if not exists public.entity_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_entity_type public.entity_type not null,
  source_entity_id uuid not null,
  target_entity_type public.entity_type not null,
  target_entity_id uuid not null,
  relation_type public.entity_relation_type not null,
  confidence numeric(5,4),
  status text not null default 'active',
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    organization_id,
    source_entity_type,
    source_entity_id,
    target_entity_type,
    target_entity_id,
    relation_type
  )
);

create index if not exists idx_entity_links_source
  on public.entity_links (organization_id, source_entity_type, source_entity_id, relation_type);

create index if not exists idx_entity_links_target
  on public.entity_links (organization_id, target_entity_type, target_entity_id, relation_type);

create table if not exists public.evidence_refs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_type public.evidence_ref_type not null,
  title text,
  description text,
  storage_bucket text,
  storage_path text,
  external_url text,
  content_hash text,
  source_entity_type public.entity_type,
  source_entity_id uuid,
  captured_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_evidence_refs_org_source
  on public.evidence_refs (organization_id, source_entity_type, source_entity_id, created_at desc)
  where source_entity_type is not null and source_entity_id is not null;

create index if not exists idx_evidence_refs_storage
  on public.evidence_refs (organization_id, storage_bucket, storage_path)
  where storage_bucket is not null and storage_path is not null;

alter table public.parties enable row level security;
alter table public.party_roles enable row level security;
alter table public.party_identifiers enable row level security;
alter table public.contacts enable row level security;
alter table public.party_contacts enable row level security;
alter table public.work_units enable row level security;
alter table public.business_events enable row level security;
alter table public.entity_links enable row level security;
alter table public.evidence_refs enable row level security;

drop policy if exists "parties_select_member" on public.parties;
create policy "parties_select_member"
on public.parties
for select
using (public.is_active_member(organization_id));

drop policy if exists "parties_insert_directory_roles" on public.parties;
create policy "parties_insert_directory_roles"
on public.parties
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "parties_update_directory_roles" on public.parties;
create policy "parties_update_directory_roles"
on public.parties
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "parties_delete_admin_roles" on public.parties;
create policy "parties_delete_admin_roles"
on public.parties
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "party_roles_select_member" on public.party_roles;
create policy "party_roles_select_member"
on public.party_roles
for select
using (public.is_active_member(organization_id));

drop policy if exists "party_roles_insert_directory_roles" on public.party_roles;
create policy "party_roles_insert_directory_roles"
on public.party_roles
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_roles_update_directory_roles" on public.party_roles;
create policy "party_roles_update_directory_roles"
on public.party_roles
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_roles_delete_admin_roles" on public.party_roles;
create policy "party_roles_delete_admin_roles"
on public.party_roles
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "party_identifiers_select_member" on public.party_identifiers;
create policy "party_identifiers_select_member"
on public.party_identifiers
for select
using (public.is_active_member(organization_id));

drop policy if exists "party_identifiers_insert_directory_roles" on public.party_identifiers;
create policy "party_identifiers_insert_directory_roles"
on public.party_identifiers
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_identifiers_update_directory_roles" on public.party_identifiers;
create policy "party_identifiers_update_directory_roles"
on public.party_identifiers
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_identifiers_delete_admin_roles" on public.party_identifiers;
create policy "party_identifiers_delete_admin_roles"
on public.party_identifiers
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "contacts_select_member" on public.contacts;
create policy "contacts_select_member"
on public.contacts
for select
using (public.is_active_member(organization_id));

drop policy if exists "contacts_insert_directory_roles" on public.contacts;
create policy "contacts_insert_directory_roles"
on public.contacts
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "contacts_update_directory_roles" on public.contacts;
create policy "contacts_update_directory_roles"
on public.contacts
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_contacts_select_member" on public.party_contacts;
create policy "party_contacts_select_member"
on public.party_contacts
for select
using (public.is_active_member(organization_id));

drop policy if exists "party_contacts_insert_directory_roles" on public.party_contacts;
create policy "party_contacts_insert_directory_roles"
on public.party_contacts
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_contacts_update_directory_roles" on public.party_contacts;
create policy "party_contacts_update_directory_roles"
on public.party_contacts
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "work_units_select_member" on public.work_units;
create policy "work_units_select_member"
on public.work_units
for select
using (public.is_active_member(organization_id));

drop policy if exists "work_units_insert_work_roles" on public.work_units;
create policy "work_units_insert_work_roles"
on public.work_units
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "work_units_update_work_roles" on public.work_units;
create policy "work_units_update_work_roles"
on public.work_units
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "work_units_delete_admin_roles" on public.work_units;
create policy "work_units_delete_admin_roles"
on public.work_units
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "business_events_select_member" on public.business_events;
create policy "business_events_select_member"
on public.business_events
for select
using (public.is_active_member(organization_id));

drop policy if exists "business_events_insert_event_roles" on public.business_events;
create policy "business_events_insert_event_roles"
on public.business_events
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "business_events_update_event_roles" on public.business_events;
create policy "business_events_update_event_roles"
on public.business_events
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "entity_links_select_member" on public.entity_links;
create policy "entity_links_select_member"
on public.entity_links
for select
using (public.is_active_member(organization_id));

drop policy if exists "entity_links_insert_event_roles" on public.entity_links;
create policy "entity_links_insert_event_roles"
on public.entity_links
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "entity_links_update_event_roles" on public.entity_links;
create policy "entity_links_update_event_roles"
on public.entity_links
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "entity_links_delete_admin_roles" on public.entity_links;
create policy "entity_links_delete_admin_roles"
on public.entity_links
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "evidence_refs_select_member" on public.evidence_refs;
create policy "evidence_refs_select_member"
on public.evidence_refs
for select
using (public.is_active_member(organization_id));

drop policy if exists "evidence_refs_insert_event_roles" on public.evidence_refs;
create policy "evidence_refs_insert_event_roles"
on public.evidence_refs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "evidence_refs_update_event_roles" on public.evidence_refs;
create policy "evidence_refs_update_event_roles"
on public.evidence_refs
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);
