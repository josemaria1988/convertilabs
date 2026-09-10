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
