create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending',
  priority text not null default 'normal',
  due_date date,
  assigned_to_member_id uuid references public.organization_members(id) on delete set null,
  party_id uuid references public.parties(id) on delete set null,
  work_unit_id uuid references public.work_units(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  process_run_id uuid,
  blocked_reason text,
  completed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_status_check check (status in ('pending', 'in_progress', 'blocked', 'done', 'cancelled')),
  constraint tasks_priority_check check (priority in ('low', 'normal', 'high', 'urgent'))
);

create index if not exists idx_tasks_org_status_due
  on public.tasks (organization_id, status, due_date, created_at desc);

create index if not exists idx_tasks_org_links
  on public.tasks (organization_id, party_id, work_unit_id, document_id);

create table if not exists public.processes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  normalized_name text,
  category text,
  description text,
  criticality text not null default 'medium',
  status text not null default 'draft',
  frequency text,
  current_owner_label text,
  future_owner_label text,
  next_run_date date,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint processes_status_check check (status in ('draft', 'active', 'paused', 'archived')),
  constraint processes_criticality_check check (criticality in ('low', 'medium', 'high', 'critical'))
);

create index if not exists idx_processes_org_status_criticality
  on public.processes (organization_id, status, criticality, updated_at desc);

create table if not exists public.process_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',
  summary text,
  published_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, process_id, version_number),
  constraint process_versions_status_check check (status in ('draft', 'published', 'archived'))
);

create index if not exists idx_process_versions_process_status
  on public.process_versions (organization_id, process_id, status, version_number desc);

create table if not exists public.process_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_version_id uuid not null references public.process_versions(id) on delete cascade,
  step_number integer not null,
  title text not null,
  description text,
  expected_evidence text,
  responsible_label text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, process_version_id, step_number)
);

create table if not exists public.process_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid references public.processes(id) on delete set null,
  process_version_id uuid references public.process_versions(id) on delete set null,
  title text not null,
  status text not null default 'pending',
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  blocked_reason text,
  party_id uuid references public.parties(id) on delete set null,
  work_unit_id uuid references public.work_units(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint process_runs_status_check check (status in ('pending', 'running', 'blocked', 'done', 'cancelled'))
);

create index if not exists idx_process_runs_org_status_due
  on public.process_runs (organization_id, status, due_date, created_at desc);

create table if not exists public.process_run_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_run_id uuid not null references public.process_runs(id) on delete cascade,
  process_step_id uuid references public.process_steps(id) on delete set null,
  step_number integer not null,
  title text not null,
  status text not null default 'pending',
  blocked_reason text,
  completed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint process_run_steps_status_check check (status in ('pending', 'running', 'blocked', 'done', 'skipped'))
);

create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  obligation_type text not null default 'administrative',
  frequency text not null default 'monthly',
  status text not null default 'active',
  responsible_label text,
  future_owner_label text,
  party_id uuid references public.parties(id) on delete set null,
  work_unit_id uuid references public.work_units(id) on delete set null,
  next_due_date date,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obligations_status_check check (status in ('active', 'paused', 'archived')),
  constraint obligations_frequency_check check (frequency in ('once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'ad_hoc'))
);

create index if not exists idx_obligations_org_status_due
  on public.obligations (organization_id, status, next_due_date);

create table if not exists public.obligation_occurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  obligation_id uuid not null references public.obligations(id) on delete cascade,
  due_date date not null,
  status text not null default 'pending',
  task_id uuid references public.tasks(id) on delete set null,
  completed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, obligation_id, due_date),
  constraint obligation_occurrences_status_check check (status in ('pending', 'done', 'blocked', 'cancelled'))
);

create table if not exists public.capture_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text,
  raw_text text not null,
  source text not null default 'manual',
  status text not null default 'captured',
  proposed_structure_json jsonb not null default '{}'::jsonb,
  party_id uuid references public.parties(id) on delete set null,
  work_unit_id uuid references public.work_units(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capture_notes_status_check check (status in ('captured', 'structured', 'accepted', 'archived'))
);

create table if not exists public.continuity_risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  risk_type text not null,
  severity text not null default 'medium',
  title text not null,
  description text,
  status text not null default 'open',
  process_id uuid references public.processes(id) on delete set null,
  obligation_id uuid references public.obligations(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  party_id uuid references public.parties(id) on delete set null,
  work_unit_id uuid references public.work_units(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint continuity_risks_status_check check (status in ('open', 'mitigating', 'resolved', 'accepted')),
  constraint continuity_risks_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create index if not exists idx_continuity_risks_org_status_severity
  on public.continuity_risks (organization_id, status, severity, created_at desc);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  interaction_type text not null,
  occurred_at timestamptz not null default now(),
  subject text not null,
  summary text,
  body text,
  direction text,
  status text not null default 'recorded',
  created_by uuid references public.profiles(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interactions_type_check check (interaction_type in ('call', 'email', 'whatsapp', 'meeting', 'note', 'visit', 'message', 'system_note')),
  constraint interactions_status_check check (status in ('recorded', 'needs_follow_up', 'closed', 'archived'))
);

create index if not exists idx_interactions_org_occurred
  on public.interactions (organization_id, occurred_at desc);

create table if not exists public.interaction_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  party_id uuid references public.parties(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  role text not null default 'participant',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, interaction_id, party_id, contact_id)
);

create table if not exists public.interaction_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  target_entity_type text not null,
  target_entity_id uuid not null,
  relation_type text not null default 'related_to',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, interaction_id, target_entity_type, target_entity_id, relation_type)
);

create index if not exists idx_interaction_links_target
  on public.interaction_links (organization_id, target_entity_type, target_entity_id, created_at desc);

alter table public.tasks enable row level security;
alter table public.processes enable row level security;
alter table public.process_versions enable row level security;
alter table public.process_steps enable row level security;
alter table public.process_runs enable row level security;
alter table public.process_run_steps enable row level security;
alter table public.obligations enable row level security;
alter table public.obligation_occurrences enable row level security;
alter table public.capture_notes enable row level security;
alter table public.continuity_risks enable row level security;
alter table public.interactions enable row level security;
alter table public.interaction_participants enable row level security;
alter table public.interaction_links enable row level security;

drop policy if exists "tasks_select_member" on public.tasks;
create policy "tasks_select_member"
on public.tasks
for select
using (public.is_active_member(organization_id));

drop policy if exists "tasks_insert_operations_roles" on public.tasks;
create policy "tasks_insert_operations_roles"
on public.tasks
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

drop policy if exists "tasks_update_operations_roles" on public.tasks;
create policy "tasks_update_operations_roles"
on public.tasks
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

drop policy if exists "tasks_delete_admin_roles" on public.tasks;
create policy "tasks_delete_admin_roles"
on public.tasks
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

drop policy if exists "processes_select_member" on public.processes;
create policy "processes_select_member"
on public.processes
for select
using (public.is_active_member(organization_id));

drop policy if exists "processes_insert_operations_roles" on public.processes;
create policy "processes_insert_operations_roles"
on public.processes
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

drop policy if exists "processes_update_operations_roles" on public.processes;
create policy "processes_update_operations_roles"
on public.processes
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

drop policy if exists "processes_delete_admin_roles" on public.processes;
create policy "processes_delete_admin_roles"
on public.processes
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

drop policy if exists "process_versions_select_member" on public.process_versions;
create policy "process_versions_select_member"
on public.process_versions
for select
using (public.is_active_member(organization_id));

drop policy if exists "process_versions_insert_operations_roles" on public.process_versions;
create policy "process_versions_insert_operations_roles"
on public.process_versions
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

drop policy if exists "process_versions_update_operations_roles" on public.process_versions;
create policy "process_versions_update_operations_roles"
on public.process_versions
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

drop policy if exists "process_steps_select_member" on public.process_steps;
create policy "process_steps_select_member"
on public.process_steps
for select
using (public.is_active_member(organization_id));

drop policy if exists "process_steps_insert_operations_roles" on public.process_steps;
create policy "process_steps_insert_operations_roles"
on public.process_steps
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

drop policy if exists "process_steps_update_operations_roles" on public.process_steps;
create policy "process_steps_update_operations_roles"
on public.process_steps
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

drop policy if exists "process_runs_select_member" on public.process_runs;
create policy "process_runs_select_member"
on public.process_runs
for select
using (public.is_active_member(organization_id));

drop policy if exists "process_runs_insert_operations_roles" on public.process_runs;
create policy "process_runs_insert_operations_roles"
on public.process_runs
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

drop policy if exists "process_runs_update_operations_roles" on public.process_runs;
create policy "process_runs_update_operations_roles"
on public.process_runs
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

drop policy if exists "process_run_steps_select_member" on public.process_run_steps;
create policy "process_run_steps_select_member"
on public.process_run_steps
for select
using (public.is_active_member(organization_id));

drop policy if exists "process_run_steps_insert_operations_roles" on public.process_run_steps;
create policy "process_run_steps_insert_operations_roles"
on public.process_run_steps
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

drop policy if exists "process_run_steps_update_operations_roles" on public.process_run_steps;
create policy "process_run_steps_update_operations_roles"
on public.process_run_steps
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

drop policy if exists "obligations_select_member" on public.obligations;
create policy "obligations_select_member"
on public.obligations
for select
using (public.is_active_member(organization_id));

drop policy if exists "obligations_insert_operations_roles" on public.obligations;
create policy "obligations_insert_operations_roles"
on public.obligations
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

drop policy if exists "obligations_update_operations_roles" on public.obligations;
create policy "obligations_update_operations_roles"
on public.obligations
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

drop policy if exists "obligation_occurrences_select_member" on public.obligation_occurrences;
create policy "obligation_occurrences_select_member"
on public.obligation_occurrences
for select
using (public.is_active_member(organization_id));

drop policy if exists "obligation_occurrences_insert_operations_roles" on public.obligation_occurrences;
create policy "obligation_occurrences_insert_operations_roles"
on public.obligation_occurrences
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

drop policy if exists "obligation_occurrences_update_operations_roles" on public.obligation_occurrences;
create policy "obligation_occurrences_update_operations_roles"
on public.obligation_occurrences
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

drop policy if exists "capture_notes_select_member" on public.capture_notes;
create policy "capture_notes_select_member"
on public.capture_notes
for select
using (public.is_active_member(organization_id));

drop policy if exists "capture_notes_insert_operations_roles" on public.capture_notes;
create policy "capture_notes_insert_operations_roles"
on public.capture_notes
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

drop policy if exists "capture_notes_update_operations_roles" on public.capture_notes;
create policy "capture_notes_update_operations_roles"
on public.capture_notes
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

drop policy if exists "continuity_risks_select_member" on public.continuity_risks;
create policy "continuity_risks_select_member"
on public.continuity_risks
for select
using (public.is_active_member(organization_id));

drop policy if exists "continuity_risks_insert_operations_roles" on public.continuity_risks;
create policy "continuity_risks_insert_operations_roles"
on public.continuity_risks
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

drop policy if exists "continuity_risks_update_operations_roles" on public.continuity_risks;
create policy "continuity_risks_update_operations_roles"
on public.continuity_risks
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

drop policy if exists "interactions_select_member" on public.interactions;
create policy "interactions_select_member"
on public.interactions
for select
using (public.is_active_member(organization_id));

drop policy if exists "interactions_insert_communications_roles" on public.interactions;
create policy "interactions_insert_communications_roles"
on public.interactions
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

drop policy if exists "interactions_update_communications_roles" on public.interactions;
create policy "interactions_update_communications_roles"
on public.interactions
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

drop policy if exists "interaction_participants_select_member" on public.interaction_participants;
create policy "interaction_participants_select_member"
on public.interaction_participants
for select
using (public.is_active_member(organization_id));

drop policy if exists "interaction_participants_insert_communications_roles" on public.interaction_participants;
create policy "interaction_participants_insert_communications_roles"
on public.interaction_participants
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

drop policy if exists "interaction_participants_update_communications_roles" on public.interaction_participants;
create policy "interaction_participants_update_communications_roles"
on public.interaction_participants
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

drop policy if exists "interaction_links_select_member" on public.interaction_links;
create policy "interaction_links_select_member"
on public.interaction_links
for select
using (public.is_active_member(organization_id));

drop policy if exists "interaction_links_insert_communications_roles" on public.interaction_links;
create policy "interaction_links_insert_communications_roles"
on public.interaction_links
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

drop policy if exists "interaction_links_update_communications_roles" on public.interaction_links;
create policy "interaction_links_update_communications_roles"
on public.interaction_links
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
