do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'accounting_rule_lifecycle_status'
  ) then
    create type public.accounting_rule_lifecycle_status as enum (
      'draft',
      'active',
      'paused',
      'superseded',
      'deleted_if_unused'
    );
  end if;
end;
$$;

alter table public.accounting_rules
  add column if not exists stable_family_code text,
  add column if not exists version_number integer not null default 1,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists lifecycle_status public.accounting_rule_lifecycle_status not null default 'active',
  add column if not exists times_matched integer not null default 0,
  add column if not exists times_applied integer not null default 0,
  add column if not exists created_from text,
  add column if not exists explainability_json jsonb not null default '{}'::jsonb,
  add column if not exists supersedes_rule_id uuid references public.accounting_rules(id) on delete set null,
  add column if not exists superseded_by_rule_id uuid references public.accounting_rules(id) on delete set null,
  add column if not exists pause_reason text,
  add column if not exists supersession_reason text,
  add column if not exists activated_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists last_matched_at timestamptz;

alter table public.accounting_rules
  alter column stable_family_code set default ('rule_family_' || gen_random_uuid()::text);

update public.accounting_rules
set
  stable_family_code = coalesce(stable_family_code, 'rule_family_' || id::text),
  version_number = coalesce(version_number, 1),
  created_from = coalesce(nullif(created_from, ''), nullif(source, ''), 'manual'),
  lifecycle_status = case
    when coalesce(is_active, true) = true then 'active'::public.accounting_rule_lifecycle_status
    when status = 'candidate'::public.accounting_rule_status then 'draft'::public.accounting_rule_lifecycle_status
    else 'paused'::public.accounting_rule_lifecycle_status
  end,
  times_applied = greatest(coalesce(times_applied, 0), coalesce(times_reused, 0)),
  times_matched = greatest(coalesce(times_matched, 0), coalesce(times_reused, 0)),
  activated_at = case
    when coalesce(is_active, true) = true then coalesce(activated_at, created_at, now())
    else activated_at
  end,
  paused_at = case
    when coalesce(is_active, true) = false
      and status <> 'candidate'::public.accounting_rule_status then coalesce(paused_at, updated_at, created_at, now())
    else paused_at
  end
where true;

alter table public.accounting_rules
  alter column stable_family_code set not null;

create index if not exists idx_accounting_rules_org_lifecycle_scope
  on public.accounting_rules (organization_id, lifecycle_status, scope, priority desc);

create index if not exists idx_accounting_rules_family_version
  on public.accounting_rules (organization_id, stable_family_code, version_number desc);

create table if not exists public.accounting_rule_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.accounting_rules(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  reason text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounting_rule_events_org_rule_created
  on public.accounting_rule_events (organization_id, rule_id, created_at desc);

insert into public.accounting_rule_events (
  organization_id,
  rule_id,
  event_type,
  reason,
  payload_json,
  created_at
)
select
  rule.organization_id,
  rule.id,
  'migrated',
  'Backfill inicial de administracion de reglas',
  jsonb_build_object(
    'scope',
    rule.scope,
    'priority',
    rule.priority,
    'source',
    rule.source,
    'created_from',
    rule.created_from,
    'lifecycle_status',
    rule.lifecycle_status
  ),
  coalesce(rule.created_at, now())
from public.accounting_rules as rule
where not exists (
  select 1
  from public.accounting_rule_events as event
  where event.rule_id = rule.id
    and event.event_type = 'migrated'
);

alter table public.accounting_rule_events enable row level security;

drop policy if exists "accounting_rule_events_select_member" on public.accounting_rule_events;
create policy "accounting_rule_events_select_member"
on public.accounting_rule_events
for select
using (public.is_active_member(organization_id));

drop policy if exists "accounting_rule_events_insert_accounting_roles" on public.accounting_rule_events;
create policy "accounting_rule_events_insert_accounting_roles"
on public.accounting_rule_events
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
