-- A complete immutable snapshot reuses the canonical integration run/raw tables.
-- Starting a run spends the organization's daily slot even if the request fails.
create unique index if not exists idx_zeta_daily_cache_one_attempt_per_day
  on public.integration_sync_runs (organization_id, (metadata_json->>'scheduledDay'))
  where provider = 'zetasoftware' and stream = 'zeta.daily_cache';

create index if not exists idx_zeta_report_snapshot_pages
  on public.integration_raw_records (organization_id, last_sync_run_id, (metadata_json->>'snapshotKey'), external_key)
  where provider = 'zetasoftware' and entity_type = 'report_snapshot_page';

create or replace function public.zeta_daily_sync_now()
returns timestamptz language sql volatile set search_path = pg_catalog
as $$ select clock_timestamp() $$;

create or replace function public.claim_zeta_daily_sync(
  p_organization_id uuid, p_actor_user_id uuid, p_max_requests integer,
  p_input jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := public.zeta_daily_sync_now();
  v_local timestamp := v_now at time zone 'America/Montevideo';
  v_day text := to_char(v_local, 'YYYY-MM-DD');
  v_run public.integration_sync_runs;
  v_connection public.organization_integration_connections;
  v_token uuid := gen_random_uuid();
begin
  if p_max_requests is null or p_max_requests < 1 or p_max_requests > 1000 then
    raise exception 'El presupuesto interno debe ser entre 1 y 1000 solicitudes.';
  end if;
  if not exists (select 1 from public.organization_members where organization_id = p_organization_id
    and user_id = p_actor_user_id and is_active and role::text in ('owner','admin','developer','admin_processing')) then
    raise exception 'El actor no puede sincronizar esta organizacion.';
  end if;
  if v_local::time < time '18:00:00' then
    return jsonb_build_object('claimed', false, 'reason', 'outside_window', 'scheduledDay', v_day);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('zeta.daily_cache:' || p_organization_id::text, 0));
  select * into v_run from public.integration_sync_runs
    where organization_id = p_organization_id and provider = 'zetasoftware' and stream = 'zeta.daily_cache'
      and metadata_json->>'scheduledDay' = v_day limit 1;
  if found then
    return jsonb_build_object('claimed', false, 'reason', 'already_attempted', 'scheduledDay', v_day,
      'runId', v_run.id, 'status', v_run.status);
  end if;
  -- An expired previous run remains evidence, never a resumable API attempt.
  update public.integration_sync_runs set status = 'failed', finished_at = v_now, updated_at = v_now,
    error_code = 'zeta_daily_lease_expired', error_message = 'La sincronizacion no termino dentro de su ventana.'
    where organization_id = p_organization_id and provider = 'zetasoftware' and stream = 'zeta.daily_cache'
      and status in ('queued','running') and (metadata_json->>'leaseExpiresAt')::timestamptz <= v_now;
  delete from public.integration_raw_records pages using public.integration_sync_runs runs
    where pages.last_sync_run_id = runs.id and pages.organization_id = p_organization_id
      and pages.provider = 'zetasoftware' and pages.entity_type = 'report_snapshot_page'
      and runs.organization_id = p_organization_id and runs.provider = 'zetasoftware' and runs.stream = 'zeta.daily_cache'
      and runs.status = 'failed' and (runs.metadata_json->>'leaseExpiresAt')::timestamptz <= v_now;
  update public.integration_sync_runs set metadata_json = metadata_json || jsonb_build_object('cachePrunedAt', v_now)
    where organization_id = p_organization_id and provider = 'zetasoftware' and stream = 'zeta.daily_cache'
      and status = 'failed' and (metadata_json->>'leaseExpiresAt')::timestamptz <= v_now
      and not (metadata_json ? 'cachePrunedAt');
  if exists (select 1 from public.integration_sync_runs where organization_id = p_organization_id
    and provider = 'zetasoftware' and stream = 'zeta.daily_cache' and status in ('queued','running')) then
    return jsonb_build_object('claimed', false, 'reason', 'active_run', 'scheduledDay', v_day);
  end if;
  select * into v_connection from public.organization_integration_connections
    where organization_id = p_organization_id and provider = 'zetasoftware' limit 1;
  if not found or v_connection.status = 'paused' or v_connection.test_mode then
    raise exception 'Se necesita una conexion real y activa para la sincronizacion diaria.';
  end if;
  insert into public.integration_sync_runs (organization_id, connection_id, provider, stream, run_kind,
    status, test_mode, initiated_by_user_id, started_at, input_json, metadata_json)
  values (p_organization_id, v_connection.id, 'zetasoftware', 'zeta.daily_cache', 'scheduled', 'running', false,
    p_actor_user_id, v_now, coalesce(p_input, '{}'::jsonb), jsonb_build_object('schemaVersion', 1,
      'scheduledDay', v_day, 'leaseToken', v_token, 'leaseExpiresAt', v_now + interval '4 hours',
      'maxRequests', p_max_requests, 'requestsUsed', 0, 'timezone', 'America/Montevideo', 'scheduledHour', 18))
  returning * into v_run;
  return jsonb_build_object('claimed', true, 'runId', v_run.id, 'leaseToken', v_token,
    'scheduledDay', v_day, 'connectionId', v_connection.id, 'maxRequests', p_max_requests);
end;
$$;

create or replace function public.reserve_zeta_daily_request(
  p_organization_id uuid, p_run_id uuid, p_lease_token uuid, p_endpoint text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_run public.integration_sync_runs; v_used integer; v_max integer;
begin
  select * into v_run from public.integration_sync_runs where id = p_run_id and organization_id = p_organization_id
    and provider = 'zetasoftware' and stream = 'zeta.daily_cache' for update;
  if not found or v_run.status <> 'running' or coalesce(v_run.metadata_json->>'leaseToken', '') <> p_lease_token::text
    or p_lease_token is null or coalesce((v_run.metadata_json->>'leaseExpiresAt')::timestamptz, '-infinity'::timestamptz) <= public.zeta_daily_sync_now() then
    raise exception 'La reserva Zeta no tiene una corrida diaria vigente.';
  end if;
  if p_endpoint is null or p_endpoint !~ '^REST[A-Za-z0-9]+$' or length(p_endpoint) > 150 then
    raise exception 'El endpoint reservado no es valido.';
  end if;
  if not exists (select 1 from public.organization_members where organization_id = p_organization_id
    and user_id = v_run.initiated_by_user_id and is_active and role::text in ('owner','admin','developer','admin_processing')) then
    raise exception 'El actor ya no puede sincronizar esta organizacion.';
  end if;
  v_used := (v_run.metadata_json->>'requestsUsed')::integer;
  v_max := (v_run.metadata_json->>'maxRequests')::integer;
  if v_used is null or v_max is null or v_used >= v_max then raise exception 'Se alcanzo el presupuesto interno de solicitudes Zeta.'; end if;
  update public.integration_sync_runs set metadata_json = metadata_json || jsonb_build_object(
    'requestsUsed', v_used + 1, 'lastEndpoint', p_endpoint, 'lastRequestAt', public.zeta_daily_sync_now()),
    updated_at = public.zeta_daily_sync_now() where id = v_run.id;
  return jsonb_build_object('requestNumber', v_used + 1, 'maxRequests', v_max);
end;
$$;

create or replace function public.guard_zeta_report_snapshot_page()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.entity_type = 'report_snapshot_page' then
    raise exception 'Las paginas de snapshots publicados o en preparacion son inmutables.';
  end if;
  if new.entity_type <> 'report_snapshot_page' then return new; end if;
  -- Serialize page insertion with final publication of its parent run.
  perform 1 from public.integration_sync_runs where id = new.last_sync_run_id
    and organization_id = new.organization_id for key share;
  if new.provider <> 'zetasoftware' or new.test_mode or jsonb_typeof(new.payload_json->'rows') is distinct from 'array'
    or coalesce(new.metadata_json->>'snapshotKey', '') !~ '^[a-f0-9]{32}$' or coalesce(new.metadata_json->>'page', '') !~ '^[1-9][0-9]*$'
    or new.last_sync_run_id is null or new.metadata_json->>'schemaVersion' is distinct from '1'
    or coalesce(new.payload_hash, '') !~ '^[a-f0-9]{64}$'
    or coalesce(new.metadata_json->>'report', '') not in ('sales','purchases','articles','stock','base-prices','sales-prices')
    or new.stream <> 'zeta.reports.' || replace(new.metadata_json->>'report', '-', '_')
    or new.external_key <> new.last_sync_run_id::text || ':' || (new.metadata_json->>'snapshotKey') || ':' || lpad(new.metadata_json->>'page', 6, '0')
    or not exists (select 1 from public.integration_sync_runs where id = new.last_sync_run_id
      and organization_id = new.organization_id and provider = 'zetasoftware' and stream = 'zeta.daily_cache'
      and status = 'running' and not test_mode and connection_id is not distinct from new.connection_id
      and (metadata_json->>'leaseExpiresAt')::timestamptz > public.zeta_daily_sync_now()) then
    raise exception 'La pagina no pertenece a un snapshot diario vigente de esta organizacion.';
  end if;
  return new;
end;
$$;

drop trigger if exists zeta_report_snapshot_page_guard on public.integration_raw_records;
create trigger zeta_report_snapshot_page_guard before insert or update on public.integration_raw_records
  for each row execute function public.guard_zeta_report_snapshot_page();

create or replace function public.publish_zeta_daily_sync(
  p_organization_id uuid, p_run_id uuid, p_lease_token uuid, p_summary jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_run public.integration_sync_runs; v_report jsonb; v_count integer; v_rows integer; v_total integer := 0;
  v_keys text[] := array[]::text[]; v_key text; v_pages integer; v_row_count integer;
begin
  select * into v_run from public.integration_sync_runs where id = p_run_id and organization_id = p_organization_id
    and provider = 'zetasoftware' and stream = 'zeta.daily_cache' for update;
  if not found or p_lease_token is null or coalesce(v_run.metadata_json->>'leaseToken', '') <> p_lease_token::text then
    raise exception 'La publicacion Zeta no pertenece a la corrida solicitada.';
  end if;
  if v_run.status = 'completed' then return jsonb_build_object('published', true, 'runId', v_run.id, 'idempotent', true); end if;
  if v_run.status <> 'running' or coalesce((v_run.metadata_json->>'leaseExpiresAt')::timestamptz, '-infinity'::timestamptz) <= public.zeta_daily_sync_now() then
    raise exception 'La corrida Zeta ya no puede publicar.';
  end if;
  if coalesce(p_summary->>'schemaVersion', '') <> '1' or jsonb_typeof(p_summary->'reports') is distinct from 'array'
    then raise exception 'El manifiesto de snapshots no es valido.'; end if;
  if jsonb_array_length(p_summary->'reports') < 1 then raise exception 'El manifiesto de snapshots no es valido.'; end if;
  if (select count(distinct value->>'report') from jsonb_array_elements(p_summary->'reports')
    where value->>'report' in ('sales','purchases','articles','stock')) <> 4 then
    raise exception 'La publicacion requiere ventas, compras, articulos y stock completos.';
  end if;
  for v_report in select value from jsonb_array_elements(p_summary->'reports') loop
    v_key := v_report->>'snapshotKey';
    if v_key is null or v_key !~ '^[a-f0-9]{32}$' or v_key = any(v_keys)
      or coalesce(v_report->>'report', '') not in ('sales','purchases','articles','stock','base-prices','sales-prices') or coalesce(v_report->>'complete', '') <> 'true'
      or coalesce(v_report->>'sha256', '') !~ '^[a-f0-9]{64}$' or jsonb_typeof(v_report->'columns') is distinct from 'array'
      or jsonb_typeof(v_report->'filters') is distinct from 'object'
      or not (v_report ?& array['cachePages','rowCount','pages','startedAt','completedAt']) then raise exception 'El snapshot tiene un manifiesto incompleto.'; end if;
    if nullif(v_report->>'startedAt', '') is null or nullif(v_report->>'completedAt', '') is null
      or (v_report->>'completedAt')::timestamptz < (v_report->>'startedAt')::timestamptz
      or coalesce(v_report->>'endpoint', '') !~ '^REST[A-Za-z0-9]+$' then
      raise exception 'El snapshot no conserva fechas y endpoint de origen validos.';
    end if;
    v_keys := array_append(v_keys, v_key);
    v_pages := (v_report->>'cachePages')::integer;
    v_row_count := (v_report->>'rowCount')::integer;
    if v_pages is null or v_pages < 1 or v_pages > 200 or v_row_count is null or v_row_count < 0 or v_row_count > 100000
      or (v_report->>'pages') is null or (v_report->>'pages')::integer < 1
      or v_pages <> greatest(1, ceil(v_row_count::numeric / 500)::integer) then raise exception 'El snapshot supera los limites permitidos.'; end if;
    select count(*), coalesce(sum(jsonb_array_length(payload_json->'rows')), 0) into v_count, v_rows
      from public.integration_raw_records where organization_id = p_organization_id and last_sync_run_id = p_run_id
        and provider = 'zetasoftware' and entity_type = 'report_snapshot_page' and metadata_json->>'snapshotKey' = v_key
        and metadata_json->>'report' = v_report->>'report'
        and (metadata_json->>'page')::integer between 1 and v_pages and not test_mode;
    if v_count <> v_pages or v_rows <> v_row_count then raise exception 'Faltan paginas o filas; se conserva el ultimo snapshot completo.'; end if;
    v_total := v_total + v_rows;
  end loop;
  -- This single state change publishes all reports together. Partial raw writes stay invisible.
  update public.integration_sync_runs set status = 'completed', finished_at = public.zeta_daily_sync_now(),
    updated_at = public.zeta_daily_sync_now(), records_seen = v_total, records_upserted = v_total,
    summary_json = p_summary where id = v_run.id;
  -- Retain two complete copies, keeping run/manifest evidence indefinitely.
  -- Never delete canonical invoices, master records or source references.
  with old_runs as (
    select id from public.integration_sync_runs where organization_id = p_organization_id
      and provider = 'zetasoftware' and stream = 'zeta.daily_cache' and status = 'completed'
    order by finished_at desc, id desc offset 2
  ) delete from public.integration_raw_records pages using old_runs
    where pages.last_sync_run_id = old_runs.id and pages.organization_id = p_organization_id
      and pages.provider = 'zetasoftware' and pages.entity_type = 'report_snapshot_page';
  with old_runs as (
    select id from public.integration_sync_runs where organization_id = p_organization_id
      and provider = 'zetasoftware' and stream = 'zeta.daily_cache' and status = 'completed'
    order by finished_at desc, id desc offset 2
  ) update public.integration_sync_runs runs set metadata_json = metadata_json || jsonb_build_object('cachePrunedAt', public.zeta_daily_sync_now())
    from old_runs where runs.id = old_runs.id and not (runs.metadata_json ? 'cachePrunedAt');
  return jsonb_build_object('published', true, 'runId', v_run.id, 'rowCount', v_total);
end;
$$;

create or replace function public.fail_zeta_daily_sync(
  p_organization_id uuid, p_run_id uuid, p_lease_token uuid, p_error_code text, p_error_message text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  update public.integration_sync_runs set status = 'failed', finished_at = public.zeta_daily_sync_now(),
    updated_at = public.zeta_daily_sync_now(), error_code = left(p_error_code, 100), error_message = left(p_error_message, 500)
    where id = p_run_id and organization_id = p_organization_id and provider = 'zetasoftware' and stream = 'zeta.daily_cache'
      and status = 'running' and metadata_json->>'leaseToken' = p_lease_token::text;
  get diagnostics v_count = row_count;
  if v_count = 1 then
    delete from public.integration_raw_records where organization_id = p_organization_id and last_sync_run_id = p_run_id
      and provider = 'zetasoftware' and entity_type = 'report_snapshot_page';
    update public.integration_sync_runs set metadata_json = metadata_json || jsonb_build_object('cachePrunedAt', public.zeta_daily_sync_now())
      where id = p_run_id and organization_id = p_organization_id;
  end if;
  return jsonb_build_object('failed', v_count = 1, 'runId', p_run_id);
end;
$$;

revoke all on function public.zeta_daily_sync_now() from public, anon, authenticated;
revoke all on function public.claim_zeta_daily_sync(uuid,uuid,integer,jsonb) from public, anon, authenticated;
revoke all on function public.reserve_zeta_daily_request(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.guard_zeta_report_snapshot_page() from public, anon, authenticated;
revoke all on function public.publish_zeta_daily_sync(uuid,uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.fail_zeta_daily_sync(uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.zeta_daily_sync_now() to service_role;
grant execute on function public.claim_zeta_daily_sync(uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.reserve_zeta_daily_request(uuid,uuid,uuid,text) to service_role;
grant execute on function public.publish_zeta_daily_sync(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.fail_zeta_daily_sync(uuid,uuid,uuid,text,text) to service_role;

-- Existing processing roles retain all ordinary integration workflows. Only the
-- service worker may create or alter daily snapshots; tenant members may read them.
alter table public.integration_sync_runs enable row level security;
alter table public.integration_raw_records enable row level security;
drop policy if exists zeta_daily_runs_insert_worker_only on public.integration_sync_runs;
create policy zeta_daily_runs_insert_worker_only on public.integration_sync_runs as restrictive
  for insert to authenticated with check (stream <> 'zeta.daily_cache');
drop policy if exists zeta_daily_runs_update_worker_only on public.integration_sync_runs;
create policy zeta_daily_runs_update_worker_only on public.integration_sync_runs as restrictive
  for update to authenticated using (stream <> 'zeta.daily_cache') with check (stream <> 'zeta.daily_cache');
drop policy if exists zeta_daily_runs_delete_worker_only on public.integration_sync_runs;
create policy zeta_daily_runs_delete_worker_only on public.integration_sync_runs as restrictive
  for delete to authenticated using (stream <> 'zeta.daily_cache');
drop policy if exists zeta_snapshot_pages_insert_worker_only on public.integration_raw_records;
create policy zeta_snapshot_pages_insert_worker_only on public.integration_raw_records as restrictive
  for insert to authenticated with check (entity_type <> 'report_snapshot_page');
drop policy if exists zeta_snapshot_pages_update_worker_only on public.integration_raw_records;
create policy zeta_snapshot_pages_update_worker_only on public.integration_raw_records as restrictive
  for update to authenticated using (entity_type <> 'report_snapshot_page') with check (entity_type <> 'report_snapshot_page');
drop policy if exists zeta_snapshot_pages_delete_worker_only on public.integration_raw_records;
create policy zeta_snapshot_pages_delete_worker_only on public.integration_raw_records as restrictive
  for delete to authenticated using (entity_type <> 'report_snapshot_page');
