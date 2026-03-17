create table if not exists public.organization_cfe_email_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_label text not null default 'Casilla principal de eFacturas',
  mailbox_email text not null,
  mailbox_email_normalized text not null,
  inbound_address text not null,
  ingestion_mode text not null default 'forwarding_alias',
  status text not null default 'pending_forwarding',
  is_active boolean not null default true,
  last_inbound_email_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (mailbox_email_normalized),
  unique (inbound_address)
);

create index if not exists idx_org_cfe_email_connections_org_user
  on public.organization_cfe_email_connections (organization_id, user_id);

create index if not exists idx_org_cfe_email_connections_org_active
  on public.organization_cfe_email_connections (organization_id, is_active, updated_at desc);

alter table public.organization_cfe_email_connections enable row level security;

drop policy if exists "organization_cfe_email_connections_select_scoped" on public.organization_cfe_email_connections;
create policy "organization_cfe_email_connections_select_scoped"
on public.organization_cfe_email_connections
for select
using (
  (
    user_id = auth.uid()
    and public.is_active_member(organization_id)
  )
  or public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_cfe_email_connections_insert_scoped" on public.organization_cfe_email_connections;
create policy "organization_cfe_email_connections_insert_scoped"
on public.organization_cfe_email_connections
for insert
with check (
  (
    user_id = auth.uid()
    and public.is_active_member(organization_id)
  )
  or public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_cfe_email_connections_update_scoped" on public.organization_cfe_email_connections;
create policy "organization_cfe_email_connections_update_scoped"
on public.organization_cfe_email_connections
for update
using (
  (
    user_id = auth.uid()
    and public.is_active_member(organization_id)
  )
  or public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'developer'::public.member_role
    ]
  )
)
with check (
  (
    user_id = auth.uid()
    and public.is_active_member(organization_id)
  )
  or public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_cfe_email_connections_delete_scoped" on public.organization_cfe_email_connections;
create policy "organization_cfe_email_connections_delete_scoped"
on public.organization_cfe_email_connections
for delete
using (
  (
    user_id = auth.uid()
    and public.is_active_member(organization_id)
  )
  or public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'developer'::public.member_role
    ]
  )
);
