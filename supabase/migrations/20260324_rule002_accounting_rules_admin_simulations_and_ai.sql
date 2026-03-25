create table if not exists public.accounting_rule_simulations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  base_rule_id uuid references public.accounting_rules(id) on delete set null,
  candidate_rule_id uuid references public.accounting_rules(id) on delete set null,
  simulation_type text not null,
  sample_size integer not null default 0,
  affected_documents_count integer not null default 0,
  affected_recent_documents_count integer not null default 0,
  summary_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounting_rule_simulations_org_rule_created
  on public.accounting_rule_simulations (organization_id, base_rule_id, created_at desc);

create table if not exists public.accounting_rule_ai_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  context_scope text not null default 'global',
  context_rule_id uuid references public.accounting_rules(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_accounting_rule_ai_threads_org_created
  on public.accounting_rule_ai_threads (organization_id, archived_at, created_at desc);

create table if not exists public.accounting_rule_ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.accounting_rule_ai_threads(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null,
  message_text text not null,
  structured_payload_json jsonb not null default '{}'::jsonb,
  referenced_rule_ids uuid[] not null default '{}'::uuid[],
  referenced_document_ids uuid[] not null default '{}'::uuid[],
  provider text,
  model text,
  tokens_input integer,
  tokens_output integer,
  estimated_cost numeric(18,8),
  created_at timestamptz not null default now()
);

create index if not exists idx_accounting_rule_ai_messages_thread_created
  on public.accounting_rule_ai_messages (thread_id, created_at desc);

alter table public.accounting_rule_simulations enable row level security;
alter table public.accounting_rule_ai_threads enable row level security;
alter table public.accounting_rule_ai_messages enable row level security;

drop policy if exists "accounting_rule_simulations_select_member" on public.accounting_rule_simulations;
create policy "accounting_rule_simulations_select_member"
on public.accounting_rule_simulations
for select
using (public.is_active_member(organization_id));

drop policy if exists "accounting_rule_simulations_insert_accounting_roles" on public.accounting_rule_simulations;
create policy "accounting_rule_simulations_insert_accounting_roles"
on public.accounting_rule_simulations
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rule_ai_threads_select_consultive_roles" on public.accounting_rule_ai_threads;
create policy "accounting_rule_ai_threads_select_consultive_roles"
on public.accounting_rule_ai_threads
for select
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rule_ai_threads_insert_consultive_roles" on public.accounting_rule_ai_threads;
create policy "accounting_rule_ai_threads_insert_consultive_roles"
on public.accounting_rule_ai_threads
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rule_ai_threads_update_consultive_roles" on public.accounting_rule_ai_threads;
create policy "accounting_rule_ai_threads_update_consultive_roles"
on public.accounting_rule_ai_threads
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rule_ai_messages_select_consultive_roles" on public.accounting_rule_ai_messages;
create policy "accounting_rule_ai_messages_select_consultive_roles"
on public.accounting_rule_ai_messages
for select
using (
  exists (
    select 1
    from public.accounting_rule_ai_threads as t
    where t.id = thread_id
      and public.has_org_role(
        t.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role
        ]
      )
  )
);

drop policy if exists "accounting_rule_ai_messages_insert_consultive_roles" on public.accounting_rule_ai_messages;
create policy "accounting_rule_ai_messages_insert_consultive_roles"
on public.accounting_rule_ai_messages
for insert
with check (
  exists (
    select 1
    from public.accounting_rule_ai_threads as t
    where t.id = thread_id
      and public.has_org_role(
        t.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role
        ]
      )
  )
);
