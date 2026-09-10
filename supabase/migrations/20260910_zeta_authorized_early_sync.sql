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
  v_manual_authorized boolean := false;
  v_manual_reason text;
begin
  if p_max_requests is null or p_max_requests < 1 or p_max_requests > 1000 then
    raise exception 'El presupuesto interno debe ser entre 1 y 1000 solicitudes.';
  end if;
  if not exists (select 1 from public.organization_members where organization_id = p_organization_id
    and user_id = p_actor_user_id and is_active and role::text in ('owner','admin','developer','admin_processing')) then
    raise exception 'El actor no puede sincronizar esta organizacion.';
  end if;
  if coalesce(p_input, '{}'::jsonb) ? 'manualAuthorization' then
    if jsonb_typeof(p_input->'manualAuthorization') is distinct from 'object'
      or jsonb_typeof(p_input->'manualAuthorization'->'reason') is distinct from 'string'
      or (p_input->'manualAuthorization') - 'reason' <> '{}'::jsonb then
      raise exception 'manualAuthorization debe contener solamente reason como texto.';
    end if;
    v_manual_reason := p_input->'manualAuthorization'->>'reason';
    if char_length(v_manual_reason) < 12 or char_length(v_manual_reason) > 500
      or v_manual_reason <> btrim(v_manual_reason, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
      or exists (select 1 from generate_series(1, 31) as control(code) where strpos(v_manual_reason, chr(control.code)) > 0) then
      raise exception 'manualAuthorization.reason requiere 12 a 500 caracteres, sin espacios extremos ni caracteres de control.';
    end if;
    v_manual_authorized := true;
  end if;
  -- A current human request may advance today's only attempt. It never changes
  -- the recurring window, daily unique slot, request budget or fenced lease.
  if v_local::time < time '18:00:00' and not v_manual_authorized then
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
      'maxRequests', p_max_requests, 'requestsUsed', 0, 'timezone', 'America/Montevideo', 'scheduledHour', 18)
      || case when v_manual_authorized then jsonb_build_object('trigger', 'user_requested',
        'scheduleOverrideApplied', v_local::time < time '18:00:00',
        'manualAuthorization', jsonb_build_object('reason', v_manual_reason, 'actorUserId', p_actor_user_id,
          'authorizedAt', v_now, 'scheduledDay', v_day, 'scope', 'advance_today_only')) else '{}'::jsonb end)
  returning * into v_run;
  return jsonb_build_object('claimed', true, 'runId', v_run.id, 'leaseToken', v_token,
    'scheduledDay', v_day, 'connectionId', v_connection.id, 'maxRequests', p_max_requests,
    'manualAuthorized', v_manual_authorized);
end;
$$;
