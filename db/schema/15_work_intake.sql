create table if not exists public.work_intake_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null default 'manual',
  source_ref_id uuid,
  integration_raw_record_id uuid references public.integration_raw_records(id) on delete set null,
  interaction_id uuid references public.interactions(id) on delete set null,
  external_source_key text,
  idempotency_key text,
  raw_text text,
  title text not null,
  description text,
  customer_name text,
  customer_email text,
  customer_phone text,
  party_id uuid references public.parties(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  work_unit_id uuid references public.work_units(id) on delete set null,
  location_text text,
  estimated_amount numeric(18,2),
  currency_code text not null default 'UYU',
  requested_date date,
  status text not null default 'captured',
  priority text not null default 'normal',
  assigned_to_member_id uuid references public.organization_members(id) on delete set null,
  next_action text,
  due_date date,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_intake_source_type_check check (
    source_type in ('manual', 'web_form', 'email', 'api', 'zeta', 'whatsapp', 'phone', 'visit', 'other')
  ),
  constraint work_intake_status_check check (
    status in (
      'captured',
      'needs_review',
      'linked_to_party',
      'linked_to_work',
      'converted_to_work',
      'quoted',
      'won',
      'lost',
      'archived'
    )
  ),
  constraint work_intake_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint work_intake_estimated_amount_check check (estimated_amount is null or estimated_amount >= 0)
);

create index if not exists idx_work_intake_items_org_status_due
  on public.work_intake_items (organization_id, status, due_date, created_at desc);

create index if not exists idx_work_intake_items_org_party
  on public.work_intake_items (organization_id, party_id, created_at desc);

create index if not exists idx_work_intake_items_org_work
  on public.work_intake_items (organization_id, work_unit_id, created_at desc);

create index if not exists idx_work_intake_items_raw_record
  on public.work_intake_items (organization_id, integration_raw_record_id);

create unique index if not exists idx_work_intake_items_idempotency
  on public.work_intake_items (organization_id, source_type, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_work_intake_items_external_source
  on public.work_intake_items (organization_id, source_type, external_source_key)
  where external_source_key is not null;

alter table public.work_intake_items enable row level security;

drop policy if exists "work_intake_items_select_member" on public.work_intake_items;
create policy "work_intake_items_select_member"
on public.work_intake_items
for select
using (public.is_active_member(organization_id));

drop policy if exists "work_intake_items_insert_operations_roles" on public.work_intake_items;
create policy "work_intake_items_insert_operations_roles"
on public.work_intake_items
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

drop policy if exists "work_intake_items_update_operations_roles" on public.work_intake_items;
create policy "work_intake_items_update_operations_roles"
on public.work_intake_items
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
