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

alter table public.documents
  add column if not exists cost_center_id uuid references public.organization_cost_centers(id) on delete set null;

create index if not exists idx_documents_org_cost_center_created_at
  on public.documents (organization_id, cost_center_id, created_at desc)
  where cost_center_id is not null;

alter table public.organization_cost_centers enable row level security;

drop policy if exists "organization_cost_centers_select_member" on public.organization_cost_centers;
create policy "organization_cost_centers_select_member"
on public.organization_cost_centers
for select
using (public.is_org_member(organization_id));

drop policy if exists "organization_cost_centers_insert_operational_roles" on public.organization_cost_centers;
create policy "organization_cost_centers_insert_operational_roles"
on public.organization_cost_centers
for insert
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.organization_members as om
    where om.organization_id = organization_cost_centers.organization_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in (
        'owner',
        'admin',
        'admin_processing',
        'accountant',
        'reviewer',
        'operator'
      )
  )
);

drop policy if exists "organization_cost_centers_update_management_roles" on public.organization_cost_centers;
create policy "organization_cost_centers_update_management_roles"
on public.organization_cost_centers
for update
using (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.organization_members as om
    where om.organization_id = organization_cost_centers.organization_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in (
        'owner',
        'admin',
        'admin_processing',
        'accountant',
        'reviewer'
      )
  )
)
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.organization_members as om
    where om.organization_id = organization_cost_centers.organization_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in (
        'owner',
        'admin',
        'admin_processing',
        'accountant',
        'reviewer'
      )
  )
);
