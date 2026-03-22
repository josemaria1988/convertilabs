update public.system_actors
set
  display_name = 'Asistente Contable',
  updated_at = now()
where id = 'system_ai_assistant';

create table if not exists public.assistant_personas (
  code text primary key,
  display_name text not null,
  scope text not null,
  system_actor_id text not null references public.system_actors(id),
  avatar_asset_path text,
  tone text,
  specialty_md text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.assistant_personas (
  code,
  display_name,
  scope,
  system_actor_id,
  avatar_asset_path,
  tone,
  specialty_md,
  is_active
)
values
  (
    'document_reviewer_assistant',
    'Asistente Contable',
    'documents',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Revision documental y propuestas contables dentro del workflow de documentos.',
    true
  ),
  (
    'tax_assistant',
    'Asistente Contable',
    'tax',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Asistencia fiscal y trazabilidad sobre IVA, validaciones y anomalias.',
    true
  ),
  (
    'close_assistant',
    'Asistente Contable',
    'close',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Asistencia sobre cierre contable, checks y bloqueos operativos.',
    true
  ),
  (
    'audit_assistant',
    'Asistente Contable',
    'audit',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Asistencia sobre imports, evidencia y resoluciones auditables.',
    true
  )
on conflict (code) do update
set
  display_name = excluded.display_name,
  scope = excluded.scope,
  system_actor_id = excluded.system_actor_id,
  avatar_asset_path = excluded.avatar_asset_path,
  tone = excluded.tone,
  specialty_md = excluded.specialty_md,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  persona_code text not null references public.assistant_personas(code),
  opened_by_profile_id uuid references public.profiles(id),
  status text not null default 'open',
  current_input_hash text,
  stale_reason text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, target_kind, target_id, persona_code)
);

create index if not exists idx_assistant_threads_org_target
  on public.assistant_threads (organization_id, target_kind, target_id, updated_at desc);

alter table public.assistant_runs
  add column if not exists thread_id uuid references public.assistant_threads(id) on delete set null,
  add column if not exists message_id uuid;

create index if not exists idx_assistant_runs_thread_created
  on public.assistant_runs (thread_id, created_at desc);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  role text not null,
  persona_code text references public.assistant_personas(code),
  created_by_profile_id uuid references public.profiles(id),
  system_actor_id text references public.system_actors(id),
  assistant_run_id uuid references public.assistant_runs(id) on delete set null,
  content_md text not null,
  structured_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_messages_thread_created
  on public.assistant_messages (thread_id, created_at desc);

alter table public.assistant_suggestions
  add column if not exists thread_id uuid references public.assistant_threads(id) on delete set null,
  add column if not exists message_id uuid references public.assistant_messages(id) on delete set null,
  add column if not exists input_hash text,
  add column if not exists evidence_hash text,
  add column if not exists confidence numeric(5,4),
  add column if not exists rationale_md text,
  add column if not exists requested_by_profile_id uuid references public.profiles(id);

create index if not exists idx_assistant_suggestions_thread_status
  on public.assistant_suggestions (thread_id, resolution_status, created_at desc);

create table if not exists public.assistant_suggestion_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  assistant_suggestion_id uuid not null references public.assistant_suggestions(id) on delete cascade,
  source_kind text not null,
  source_id text not null,
  snapshot_ref text,
  source_hash_at_read text,
  excerpt_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_suggestion_evidence_refs_suggestion
  on public.assistant_suggestion_evidence_refs (assistant_suggestion_id, source_kind);

alter table public.assistant_personas enable row level security;
alter table public.assistant_threads enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_suggestion_evidence_refs enable row level security;

drop policy if exists "assistant_personas_select_authenticated" on public.assistant_personas;
create policy "assistant_personas_select_authenticated"
on public.assistant_personas
for select
using (auth.role() = 'authenticated');

drop policy if exists "assistant_threads_select_consultive_roles" on public.assistant_threads;
create policy "assistant_threads_select_consultive_roles"
on public.assistant_threads
for select
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
);

drop policy if exists "assistant_threads_insert_consultive_roles" on public.assistant_threads;
create policy "assistant_threads_insert_consultive_roles"
on public.assistant_threads
for insert
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

drop policy if exists "assistant_threads_update_consultive_roles" on public.assistant_threads;
create policy "assistant_threads_update_consultive_roles"
on public.assistant_threads
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

drop policy if exists "assistant_runs_select_member" on public.assistant_runs;
create policy "assistant_runs_select_member"
on public.assistant_runs
for select
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
);

drop policy if exists "assistant_runs_insert_processing_roles" on public.assistant_runs;
create policy "assistant_runs_insert_processing_roles"
on public.assistant_runs
for insert
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

drop policy if exists "assistant_run_evidence_refs_select_member" on public.assistant_run_evidence_refs;
create policy "assistant_run_evidence_refs_select_member"
on public.assistant_run_evidence_refs
for select
using (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_run_evidence_refs_insert_processing_roles" on public.assistant_run_evidence_refs;
create policy "assistant_run_evidence_refs_insert_processing_roles"
on public.assistant_run_evidence_refs
for insert
with check (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_messages_select_consultive_roles" on public.assistant_messages;
create policy "assistant_messages_select_consultive_roles"
on public.assistant_messages
for select
using (
  exists (
    select 1
    from public.assistant_threads as at
    where at.id = thread_id
      and public.has_org_role(
        at.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_messages_insert_consultive_roles" on public.assistant_messages;
create policy "assistant_messages_insert_consultive_roles"
on public.assistant_messages
for insert
with check (
  exists (
    select 1
    from public.assistant_threads as at
    where at.id = thread_id
      and public.has_org_role(
        at.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_suggestions_select_member" on public.assistant_suggestions;
create policy "assistant_suggestions_select_member"
on public.assistant_suggestions
for select
using (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_suggestions_insert_processing_roles" on public.assistant_suggestions;
create policy "assistant_suggestions_insert_processing_roles"
on public.assistant_suggestions
for insert
with check (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_suggestions_update_processing_roles" on public.assistant_suggestions;
create policy "assistant_suggestions_update_processing_roles"
on public.assistant_suggestions
for update
using (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
)
with check (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_suggestion_evidence_refs_select_consultive_roles" on public.assistant_suggestion_evidence_refs;
create policy "assistant_suggestion_evidence_refs_select_consultive_roles"
on public.assistant_suggestion_evidence_refs
for select
using (
  exists (
    select 1
    from public.assistant_suggestions as sug
    join public.assistant_runs as ar
      on ar.id = sug.assistant_run_id
    where sug.id = assistant_suggestion_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_suggestion_evidence_refs_insert_consultive_roles" on public.assistant_suggestion_evidence_refs;
create policy "assistant_suggestion_evidence_refs_insert_consultive_roles"
on public.assistant_suggestion_evidence_refs
for insert
with check (
  exists (
    select 1
    from public.assistant_suggestions as sug
    join public.assistant_runs as ar
      on ar.id = sug.assistant_run_id
    where sug.id = assistant_suggestion_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);
