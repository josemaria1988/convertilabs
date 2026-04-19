-- Convertilabs current DB parity repair.
-- Safe catch-up for the schema state exported from Supabase on 2026-04-19.
--
-- This is not a bootstrap script. It expects the canonical baseline tables to
-- already exist and only reinforces the recent close/assistant/tax additions.
-- It intentionally does not drop or truncate data.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.journal_entries') is null then
    raise exception 'Missing required table public.journal_entries. Run the canonical baseline before this repair.';
  end if;

  if to_regclass('public.journal_entry_lines') is null then
    raise exception 'Missing required table public.journal_entry_lines. Run the canonical baseline before this repair.';
  end if;

  if to_regclass('public.fiscal_periods') is null then
    raise exception 'Missing required table public.fiscal_periods. Run the canonical baseline before this repair.';
  end if;

  if to_regclass('public.close_check_runs') is null then
    raise exception 'Missing required table public.close_check_runs. Apply close001 before this repair.';
  end if;

  if to_regclass('public.close_check_results') is null then
    raise exception 'Missing required table public.close_check_results. Apply close001 before this repair.';
  end if;

  if to_regclass('public.fiscal_period_transition_logs') is null then
    raise exception 'Missing required table public.fiscal_period_transition_logs. Apply close001 before this repair.';
  end if;

  if to_regclass('public.system_actors') is null then
    raise exception 'Missing required table public.system_actors. Apply close001 before this repair.';
  end if;

  if to_regclass('public.assistant_personas') is null then
    raise exception 'Missing required table public.assistant_personas. Apply doc017 before this repair.';
  end if;

  if to_regclass('public.assistant_runs') is null then
    raise exception 'Missing required table public.assistant_runs. Apply close001 before this repair.';
  end if;

  if to_regclass('public.assistant_run_evidence_refs') is null then
    raise exception 'Missing required table public.assistant_run_evidence_refs. Apply close001 before this repair.';
  end if;

  if to_regclass('public.assistant_threads') is null then
    raise exception 'Missing required table public.assistant_threads. Apply doc017 before this repair.';
  end if;

  if to_regclass('public.assistant_messages') is null then
    raise exception 'Missing required table public.assistant_messages. Apply doc017 before this repair.';
  end if;

  if to_regclass('public.assistant_suggestions') is null then
    raise exception 'Missing required table public.assistant_suggestions. Apply close001 before this repair.';
  end if;

  if to_regclass('public.assistant_suggestion_evidence_refs') is null then
    raise exception 'Missing required table public.assistant_suggestion_evidence_refs. Apply doc017 before this repair.';
  end if;

  if to_regclass('public.tax_period_document_selections') is null then
    raise exception 'Missing required table public.tax_period_document_selections. Apply tax018 before this repair.';
  end if;
end
$$;

create or replace function public.is_active_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members as om
    where om.organization_id = p_org_id
      and om.user_id = auth.uid()
      and om.is_active = true
  );
$$;

create or replace function public.has_org_role(
  p_org_id uuid,
  p_allowed_roles public.member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members as om
    where om.organization_id = p_org_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role = any(p_allowed_roles)
  );
$$;

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

create or replace function public.finalize_journal_entry_period_failure(
  p_fiscal_period_id uuid,
  p_entry_date date
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when $1 is null then 'missing_fiscal_period_id'
    when not exists (
      select 1
      from public.fiscal_periods as fp
      where fp.id = $1
    ) then 'missing_fiscal_period'
    when exists (
      select 1
      from public.fiscal_periods as fp
      where fp.id = $1
        and ($2 < fp.starts_on or $2 > fp.ends_on)
    ) then 'date_outside_period'
    when exists (
      select 1
      from public.fiscal_periods as fp
      where fp.id = $1
        and (
          fp.status in (
            'closed'::public.fiscal_period_status,
            'locked'::public.fiscal_period_status,
            'soft_closed'::public.fiscal_period_status,
            'tax_locked'::public.fiscal_period_status,
            'hard_closed'::public.fiscal_period_status,
            'audit_frozen'::public.fiscal_period_status
          )
          or fp.locked_at is not null
        )
    ) then 'period_locked'
    else null
  end;
$$;

create or replace function public.finalize_journal_entry_accounting_lock_blocks(
  p_organization_id uuid,
  p_entry_date date
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.accounting_settings as settings
    where settings.organization_id = $1
      and settings.modifications_locked_before is not null
      and $2 <= settings.modifications_locked_before
  );
$$;

create or replace function public.finalize_journal_entry_line_totals(
  p_journal_entry_id uuid
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'line_count',
    count(*)::integer,
    'total_debit',
    coalesce(sum(jel.debit), 0)::numeric(18,2),
    'total_credit',
    coalesce(sum(jel.credit), 0)::numeric(18,2),
    'functional_total_debit',
    coalesce(sum(jel.functional_debit), 0)::numeric(18,2),
    'functional_total_credit',
    coalesce(sum(jel.functional_credit), 0)::numeric(18,2)
  )
  from public.journal_entry_lines as jel
  where jel.journal_entry_id = $1;
$$;

create or replace function public.finalize_journal_entry_next_number(
  p_organization_id uuid,
  p_excluded_journal_entry_id uuid
)
returns bigint
language sql
stable
set search_path = public
as $$
  select coalesce(max(je.entry_number), 0) + 1
  from public.journal_entries as je
  where je.organization_id = $1
    and je.id <> $2;
$$;

create or replace function public.finalize_journal_entry()
returns trigger
language plpgsql
as $$
declare
  v_period_failure text;
  v_totals jsonb;
  v_line_count integer;
  v_total_debit numeric(18,2);
  v_total_credit numeric(18,2);
  v_functional_total_debit numeric(18,2);
  v_functional_total_credit numeric(18,2);
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.immutable_at is null and new.immutable_at is not null then
    if new.status not in ('posted'::public.entry_status, 'exported'::public.entry_status) then
      raise exception 'No se puede finalizar un asiento sin status posted/exported.';
    end if;

    v_period_failure := public.finalize_journal_entry_period_failure(
      new.fiscal_period_id,
      new.entry_date
    );

    if v_period_failure = 'missing_fiscal_period_id' then
      raise exception 'No se puede finalizar un asiento sin fiscal_period_id.';
    elsif v_period_failure = 'missing_fiscal_period' then
      raise exception 'No existe el periodo contable asociado al asiento.';
    elsif v_period_failure = 'date_outside_period' then
      raise exception 'La fecha del asiento queda fuera del periodo contable seleccionado.';
    elsif v_period_failure = 'period_locked' then
      raise exception 'No se puede finalizar un asiento en un periodo cerrado o bloqueado.';
    end if;

    if public.finalize_journal_entry_accounting_lock_blocks(
      new.organization_id,
      new.entry_date
    ) then
      raise exception 'La fecha del asiento cae antes del lock contable configurado.';
    end if;

    v_totals := public.finalize_journal_entry_line_totals(new.id);
    v_line_count := coalesce((v_totals ->> 'line_count')::integer, 0);
    v_total_debit := coalesce((v_totals ->> 'total_debit')::numeric, 0)::numeric(18,2);
    v_total_credit := coalesce((v_totals ->> 'total_credit')::numeric, 0)::numeric(18,2);
    v_functional_total_debit := coalesce((v_totals ->> 'functional_total_debit')::numeric, 0)::numeric(18,2);
    v_functional_total_credit := coalesce((v_totals ->> 'functional_total_credit')::numeric, 0)::numeric(18,2);

    if v_line_count = 0 then
      raise exception 'No se puede finalizar un asiento sin lineas.';
    end if;

    if abs(v_total_debit - v_total_credit) > 0.01 then
      raise exception 'Debe y Haber no cuadran al finalizar el asiento.';
    end if;

    if abs(v_functional_total_debit - v_functional_total_credit) > 0.01 then
      raise exception 'Los montos funcionales no cuadran al finalizar el asiento.';
    end if;

    if abs(coalesce(new.total_debit, 0) - v_total_debit) > 0.01
      or abs(coalesce(new.total_credit, 0) - v_total_credit) > 0.01
      or abs(coalesce(new.functional_total_debit, 0) - v_functional_total_debit) > 0.01
      or abs(coalesce(new.functional_total_credit, 0) - v_functional_total_credit) > 0.01 then
      raise exception 'Los totales del encabezado no coinciden con las lineas del asiento.';
    end if;

    new.total_debit := v_total_debit;
    new.total_credit := v_total_credit;
    new.functional_total_debit := v_functional_total_debit;
    new.functional_total_credit := v_functional_total_credit;
    new.immutable_at := coalesce(new.immutable_at, now());

    if new.entry_number is null then
      perform pg_advisory_xact_lock(hashtext(new.organization_id::text));
      new.entry_number := public.finalize_journal_entry_next_number(
        new.organization_id,
        new.id
      );
    end if;
  elsif new.status in ('posted'::public.entry_status, 'exported'::public.entry_status)
    and new.immutable_at is null then
    raise exception 'No se puede dejar un asiento posted/exported sin immutable_at.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_finalize_journal_entry on public.journal_entries;
create trigger trg_finalize_journal_entry
before update on public.journal_entries
for each row
execute function public.finalize_journal_entry();

insert into public.system_actors (
  id,
  display_name,
  actor_kind,
  is_active,
  metadata_json
)
values (
  'system_ai_assistant',
  'Asistente Contable',
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

create or replace function pg_temp.has_unique_constraint(
  p_table regclass,
  p_columns text[]
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from pg_constraint as con
    where con.conrelid = p_table
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by cols.ord)
        from unnest(con.conkey) with ordinality as cols(attnum, ord)
        join pg_attribute as att
          on att.attrelid = con.conrelid
         and att.attnum = cols.attnum
      ) = p_columns
  );
$$;

do $$
begin
  if exists (
    select 1
    from public.close_check_results
    group by close_check_run_id, check_code
    having count(*) > 1
  ) then
    raise exception 'Cannot add close_check_results unique constraint: duplicate (close_check_run_id, check_code) rows exist.';
  end if;

  if not pg_temp.has_unique_constraint(
    'public.close_check_results'::regclass,
    array['close_check_run_id', 'check_code']
  ) then
    alter table public.close_check_results
      add constraint close_check_results_run_check_code_key
      unique (close_check_run_id, check_code);
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from public.assistant_threads
    group by organization_id, target_kind, target_id, persona_code
    having count(*) > 1
  ) then
    raise exception 'Cannot add assistant_threads unique constraint: duplicate (organization_id, target_kind, target_id, persona_code) rows exist.';
  end if;

  if not pg_temp.has_unique_constraint(
    'public.assistant_threads'::regclass,
    array['organization_id', 'target_kind', 'target_id', 'persona_code']
  ) then
    alter table public.assistant_threads
      add constraint assistant_threads_org_target_persona_key
      unique (organization_id, target_kind, target_id, persona_code);
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from public.tax_period_document_selections
    group by organization_id, period_id, document_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add tax_period_document_selections unique constraint: duplicate (organization_id, period_id, document_id) rows exist.';
  end if;

  if not pg_temp.has_unique_constraint(
    'public.tax_period_document_selections'::regclass,
    array['organization_id', 'period_id', 'document_id']
  ) then
    alter table public.tax_period_document_selections
      add constraint tax_period_document_selections_org_period_document_key
      unique (organization_id, period_id, document_id);
  end if;
end
$$;

create index if not exists idx_fiscal_periods_org_status
  on public.fiscal_periods (organization_id, status, starts_on desc);

create index if not exists idx_close_check_runs_org_period_created
  on public.close_check_runs (organization_id, fiscal_period_id, created_at desc);

create index if not exists idx_close_check_results_run_status
  on public.close_check_results (close_check_run_id, status);

create index if not exists idx_fiscal_period_transition_logs_org_period_created
  on public.fiscal_period_transition_logs (organization_id, fiscal_period_id, created_at desc);

create index if not exists idx_assistant_runs_org_target_created
  on public.assistant_runs (organization_id, target_kind, target_id, created_at desc);

create index if not exists idx_assistant_runs_org_scope_created
  on public.assistant_runs (organization_id, scope, created_at desc);

create index if not exists idx_assistant_runs_thread_created
  on public.assistant_runs (thread_id, created_at desc);

create index if not exists idx_assistant_run_evidence_refs_run
  on public.assistant_run_evidence_refs (assistant_run_id, source_kind);

create index if not exists idx_assistant_threads_org_target
  on public.assistant_threads (organization_id, target_kind, target_id, updated_at desc);

create index if not exists idx_assistant_messages_thread_created
  on public.assistant_messages (thread_id, created_at desc);

create index if not exists idx_assistant_suggestions_run_status
  on public.assistant_suggestions (assistant_run_id, resolution_status, created_at desc);

create index if not exists idx_assistant_suggestions_thread_status
  on public.assistant_suggestions (thread_id, resolution_status, created_at desc);

create index if not exists idx_assistant_suggestion_evidence_refs_suggestion
  on public.assistant_suggestion_evidence_refs (assistant_suggestion_id, source_kind);

create index if not exists idx_tax_period_document_selections_period_status
  on public.tax_period_document_selections (organization_id, period_id, selection_status, decided_at desc);

alter table public.fiscal_periods enable row level security;
alter table public.close_check_runs enable row level security;
alter table public.close_check_results enable row level security;
alter table public.fiscal_period_transition_logs enable row level security;
alter table public.system_actors enable row level security;
alter table public.assistant_personas enable row level security;
alter table public.assistant_runs enable row level security;
alter table public.assistant_run_evidence_refs enable row level security;
alter table public.assistant_threads enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_suggestions enable row level security;
alter table public.assistant_suggestion_evidence_refs enable row level security;
alter table public.tax_period_document_selections enable row level security;

drop policy if exists "system_actors_select_authenticated" on public.system_actors;
create policy "system_actors_select_authenticated"
on public.system_actors
for select
using (auth.role() = 'authenticated');

drop policy if exists "assistant_personas_select_authenticated" on public.assistant_personas;
create policy "assistant_personas_select_authenticated"
on public.assistant_personas
for select
using (auth.role() = 'authenticated');

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

drop policy if exists "tax_period_document_selections_select_member" on public.tax_period_document_selections;
create policy "tax_period_document_selections_select_member"
on public.tax_period_document_selections
for select
using (public.is_active_member(organization_id));

drop policy if exists "tax_period_document_selections_insert_accounting_roles" on public.tax_period_document_selections;
create policy "tax_period_document_selections_insert_accounting_roles"
on public.tax_period_document_selections
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "tax_period_document_selections_update_accounting_roles" on public.tax_period_document_selections;
create policy "tax_period_document_selections_update_accounting_roles"
on public.tax_period_document_selections
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
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
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

select
  to_regclass('public.close_check_runs') is not null as has_close_check_runs,
  to_regclass('public.close_check_results') is not null as has_close_check_results,
  to_regclass('public.assistant_threads') is not null as has_assistant_threads,
  to_regclass('public.assistant_messages') is not null as has_assistant_messages,
  to_regclass('public.tax_period_document_selections') is not null as has_tax_period_document_selections,
  to_regproc('public.finalize_journal_entry') is not null as has_finalize_journal_entry;
