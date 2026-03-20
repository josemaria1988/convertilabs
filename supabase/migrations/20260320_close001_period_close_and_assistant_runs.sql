alter type public.fiscal_period_status add value if not exists 'ready_to_close';
alter type public.fiscal_period_status add value if not exists 'soft_closed';
alter type public.fiscal_period_status add value if not exists 'tax_locked';
alter type public.fiscal_period_status add value if not exists 'hard_closed';
alter type public.fiscal_period_status add value if not exists 'audit_frozen';

alter table public.fiscal_periods
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references public.profiles(id);

update public.fiscal_periods
set status_changed_at = coalesce(
  status_changed_at,
  reopened_at,
  locked_at,
  closed_at,
  updated_at,
  created_at,
  now()
)
where status_changed_at is null;

create index if not exists idx_fiscal_periods_org_status
  on public.fiscal_periods (organization_id, status, starts_on desc);

create table if not exists public.close_check_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_period_id uuid not null references public.fiscal_periods(id) on delete cascade,
  run_kind text not null default 'manual',
  status text not null default 'warning',
  triggered_by_profile_id uuid references public.profiles(id),
  input_hash text,
  summary_json jsonb not null default '{}'::jsonb,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_close_check_runs_org_period_created
  on public.close_check_runs (organization_id, fiscal_period_id, created_at desc);

create table if not exists public.close_check_results (
  id uuid primary key default gen_random_uuid(),
  close_check_run_id uuid not null references public.close_check_runs(id) on delete cascade,
  check_code text not null,
  family text not null,
  severity text not null,
  status text not null,
  message text not null,
  metric_value numeric(18,2),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (close_check_run_id, check_code)
);

create index if not exists idx_close_check_results_run_status
  on public.close_check_results (close_check_run_id, status);

create table if not exists public.fiscal_period_transition_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_period_id uuid not null references public.fiscal_periods(id) on delete cascade,
  from_status public.fiscal_period_status,
  to_status public.fiscal_period_status not null,
  changed_by_profile_id uuid references public.profiles(id),
  reason_code text,
  reason_comment text,
  validator_run_id uuid references public.close_check_runs(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_fiscal_period_transition_logs_org_period_created
  on public.fiscal_period_transition_logs (organization_id, fiscal_period_id, created_at desc);

create or replace function public.finalize_journal_entry()
returns trigger
language plpgsql
as $$
declare
  period_record record;
  locked_before date;
  line_totals record;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.immutable_at is null and new.immutable_at is not null then
    if new.status not in ('posted', 'exported') then
      raise exception 'No se puede finalizar un asiento sin status posted/exported.';
    end if;

    if new.fiscal_period_id is null then
      raise exception 'No se puede finalizar un asiento sin fiscal_period_id.';
    end if;

    select id, starts_on, ends_on, status, locked_at
    into period_record
    from public.fiscal_periods
    where id = new.fiscal_period_id;

    if period_record.id is null then
      raise exception 'No existe el periodo contable asociado al asiento.';
    end if;

    if new.entry_date < period_record.starts_on or new.entry_date > period_record.ends_on then
      raise exception 'La fecha del asiento queda fuera del periodo contable seleccionado.';
    end if;

    if period_record.status in (
      'closed',
      'locked',
      'soft_closed',
      'tax_locked',
      'hard_closed',
      'audit_frozen'
    ) or period_record.locked_at is not null then
      raise exception 'No se puede finalizar un asiento en un periodo cerrado o bloqueado.';
    end if;

    select modifications_locked_before
    into locked_before
    from public.accounting_settings
    where organization_id = new.organization_id
    limit 1;

    if locked_before is not null and new.entry_date <= locked_before then
      raise exception 'La fecha del asiento cae antes del lock contable configurado.';
    end if;

    select
      count(*) as line_count,
      coalesce(sum(debit), 0)::numeric(18,2) as total_debit,
      coalesce(sum(credit), 0)::numeric(18,2) as total_credit,
      coalesce(sum(functional_debit), 0)::numeric(18,2) as functional_total_debit,
      coalesce(sum(functional_credit), 0)::numeric(18,2) as functional_total_credit
    into line_totals
    from public.journal_entry_lines
    where journal_entry_id = new.id;

    if coalesce(line_totals.line_count, 0) = 0 then
      raise exception 'No se puede finalizar un asiento sin lineas.';
    end if;

    if abs(coalesce(line_totals.total_debit, 0) - coalesce(line_totals.total_credit, 0)) > 0.01 then
      raise exception 'Debe y Haber no cuadran al finalizar el asiento.';
    end if;

    if abs(
      coalesce(line_totals.functional_total_debit, 0)
      - coalesce(line_totals.functional_total_credit, 0)
    ) > 0.01 then
      raise exception 'Los montos funcionales no cuadran al finalizar el asiento.';
    end if;

    if abs(coalesce(new.total_debit, 0) - coalesce(line_totals.total_debit, 0)) > 0.01
      or abs(coalesce(new.total_credit, 0) - coalesce(line_totals.total_credit, 0)) > 0.01
      or abs(
        coalesce(new.functional_total_debit, 0)
        - coalesce(line_totals.functional_total_debit, 0)
      ) > 0.01
      or abs(
        coalesce(new.functional_total_credit, 0)
        - coalesce(line_totals.functional_total_credit, 0)
      ) > 0.01 then
      raise exception 'Los totales del encabezado no coinciden con las lineas del asiento.';
    end if;

    new.total_debit := line_totals.total_debit;
    new.total_credit := line_totals.total_credit;
    new.functional_total_debit := line_totals.functional_total_debit;
    new.functional_total_credit := line_totals.functional_total_credit;
    new.immutable_at := coalesce(new.immutable_at, now());

    if new.entry_number is null then
      perform pg_advisory_xact_lock(hashtext(new.organization_id::text));

      select coalesce(max(entry_number), 0) + 1
      into new.entry_number
      from public.journal_entries
      where organization_id = new.organization_id
        and id <> new.id;
    end if;
  elsif new.status in ('posted', 'exported') and new.immutable_at is null then
    raise exception 'No se puede dejar un asiento posted/exported sin immutable_at.';
  end if;

  return new;
end;
$$;

create table if not exists public.system_actors (
  id text primary key,
  display_name text not null,
  actor_kind text not null default 'ai_assistant',
  is_active boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.system_actors (
  id,
  display_name,
  actor_kind,
  is_active,
  metadata_json
)
values (
  'system_ai_assistant',
  'Asistente IA del sistema',
  'ai_assistant',
  true,
  jsonb_build_object(
    'personas',
    jsonb_build_array(
      'document_reviewer_assistant',
      'close_assistant',
      'tax_assistant',
      'audit_assistant'
    )
  )
)
on conflict (id) do update
set
  display_name = excluded.display_name,
  actor_kind = excluded.actor_kind,
  is_active = excluded.is_active,
  metadata_json = excluded.metadata_json,
  updated_at = now();

create table if not exists public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by_profile_id uuid references public.profiles(id),
  system_actor_id text not null references public.system_actors(id),
  persona text not null,
  scope text not null,
  target_kind text not null,
  target_id text not null,
  input_hash text,
  prompt_template_key text,
  prompt_template_version text,
  provider text,
  model text,
  model_version text,
  status text not null default 'completed',
  confidence numeric(5,4),
  rationale_markdown text,
  output_json jsonb not null default '{}'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  request_payload_json jsonb not null default '{}'::jsonb,
  response_payload_json jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_assistant_runs_org_target_created
  on public.assistant_runs (organization_id, target_kind, target_id, created_at desc);

create index if not exists idx_assistant_runs_org_scope_created
  on public.assistant_runs (organization_id, scope, created_at desc);

create table if not exists public.assistant_run_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  assistant_run_id uuid not null references public.assistant_runs(id) on delete cascade,
  source_kind text not null,
  source_id text not null,
  snapshot_ref text,
  source_hash_at_read text,
  excerpt_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_run_evidence_refs_run
  on public.assistant_run_evidence_refs (assistant_run_id, source_kind);

create table if not exists public.assistant_suggestions (
  id uuid primary key default gen_random_uuid(),
  assistant_run_id uuid not null references public.assistant_runs(id) on delete cascade,
  suggestion_type text not null,
  proposed_payload_json jsonb not null default '{}'::jsonb,
  resolution_status text not null default 'pending',
  resolved_by_profile_id uuid references public.profiles(id),
  resolved_at timestamptz,
  resolution_comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_suggestions_run_status
  on public.assistant_suggestions (assistant_run_id, resolution_status, created_at desc);

alter table public.fiscal_periods enable row level security;
alter table public.close_check_runs enable row level security;
alter table public.close_check_results enable row level security;
alter table public.fiscal_period_transition_logs enable row level security;
alter table public.system_actors enable row level security;
alter table public.assistant_runs enable row level security;
alter table public.assistant_run_evidence_refs enable row level security;
alter table public.assistant_suggestions enable row level security;

drop policy if exists "fiscal_periods_select_member" on public.fiscal_periods;
create policy "fiscal_periods_select_member"
on public.fiscal_periods
for select
using (public.is_active_member(organization_id));

drop policy if exists "fiscal_periods_insert_close_roles" on public.fiscal_periods;
create policy "fiscal_periods_insert_close_roles"
on public.fiscal_periods
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

drop policy if exists "fiscal_periods_update_close_roles" on public.fiscal_periods;
create policy "fiscal_periods_update_close_roles"
on public.fiscal_periods
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

drop policy if exists "close_check_runs_select_member" on public.close_check_runs;
create policy "close_check_runs_select_member"
on public.close_check_runs
for select
using (public.is_active_member(organization_id));

drop policy if exists "close_check_runs_insert_close_roles" on public.close_check_runs;
create policy "close_check_runs_insert_close_roles"
on public.close_check_runs
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

drop policy if exists "close_check_results_select_member" on public.close_check_results;
create policy "close_check_results_select_member"
on public.close_check_results
for select
using (
  exists (
    select 1
    from public.close_check_runs as ccr
    where ccr.id = close_check_run_id
      and public.is_active_member(ccr.organization_id)
  )
);

drop policy if exists "close_check_results_insert_close_roles" on public.close_check_results;
create policy "close_check_results_insert_close_roles"
on public.close_check_results
for insert
with check (
  exists (
    select 1
    from public.close_check_runs as ccr
    where ccr.id = close_check_run_id
      and public.has_org_role(
        ccr.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role
        ]
      )
  )
);

drop policy if exists "fiscal_period_transition_logs_select_member" on public.fiscal_period_transition_logs;
create policy "fiscal_period_transition_logs_select_member"
on public.fiscal_period_transition_logs
for select
using (public.is_active_member(organization_id));

drop policy if exists "fiscal_period_transition_logs_insert_close_roles" on public.fiscal_period_transition_logs;
create policy "fiscal_period_transition_logs_insert_close_roles"
on public.fiscal_period_transition_logs
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

drop policy if exists "system_actors_select_authenticated" on public.system_actors;
create policy "system_actors_select_authenticated"
on public.system_actors
for select
using (auth.role() = 'authenticated');

drop policy if exists "assistant_runs_select_member" on public.assistant_runs;
create policy "assistant_runs_select_member"
on public.assistant_runs
for select
using (public.is_active_member(organization_id));

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
      'reviewer'::public.member_role,
      'operator'::public.member_role
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
      and public.is_active_member(ar.organization_id)
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
          'reviewer'::public.member_role,
          'operator'::public.member_role
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
      and public.is_active_member(ar.organization_id)
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
          'reviewer'::public.member_role,
          'operator'::public.member_role
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
          'reviewer'::public.member_role,
          'operator'::public.member_role
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
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
);
