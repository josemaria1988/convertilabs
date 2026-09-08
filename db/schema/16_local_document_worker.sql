-- Outbound local workers share the existing tenant-scoped queue.
-- These RPCs are service-role only; the companion restricts its configured organization.
alter table public.document_processing_runs
  add column if not exists lease_owner text,
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists available_at timestamptz not null default now();

create index if not exists idx_document_processing_local_queue
  on public.document_processing_runs (organization_id, provider_code, status, available_at, created_at);

create or replace function public.guard_document_processing_run_enqueue()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  perform 1 from public.documents where id = new.document_id and organization_id = new.organization_id for update;
  if not found then raise exception 'Documento ajeno a la organizacion'; end if;
  if new.status in ('queued', 'processing') and exists (select 1 from public.document_processing_runs
    where document_id = new.document_id and status in ('queued', 'processing')) then
    raise exception 'document_processing_already_active';
  end if;
  return new;
end $$;
drop trigger if exists guard_document_processing_run_enqueue on public.document_processing_runs;
create trigger guard_document_processing_run_enqueue before insert on public.document_processing_runs
  for each row execute function public.guard_document_processing_run_enqueue();

create or replace function public.enqueue_local_document_processing(
  p_organization_id uuid, p_document_id uuid, p_requested_by uuid,
  p_triggered_by text, p_rule_snapshot_id uuid
) returns uuid language plpgsql security invoker set search_path = public as $$
declare d public.documents; existing_run public.document_processing_runs; next_number integer; result_id uuid;
begin
  select * into strict d from public.documents
    where id = p_document_id and organization_id = p_organization_id for update;
  if d.status::text in ('approved', 'confirmed', 'posted_final', 'locked', 'duplicate', 'rejected', 'archived')
    or d.posting_status::text in ('posted_provisional', 'posted_final', 'locked') then
    raise exception 'El documento no admite otra extraccion en su estado actual';
  end if;
  if p_requested_by is not null and not exists (select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = p_requested_by and is_active and role::text <> 'viewer') then
    raise exception 'El solicitante no puede procesar documentos de esta organizacion';
  end if;
  if p_rule_snapshot_id is null or not exists (select 1 from public.organization_rule_snapshots
    where id = p_rule_snapshot_id and organization_id = p_organization_id) then
    raise exception 'Snapshot ajeno a la organizacion';
  end if;
  select * into existing_run from public.document_processing_runs
    where document_id = d.id and status in ('queued', 'processing') order by created_at desc limit 1;
  if found then
    if existing_run.provider_code <> 'codex_local' then
      raise exception 'Existe una corrida activa de otro proveedor; esperar su finalizacion';
    end if;
    return existing_run.id;
  end if;
  select coalesce(max(run_number), 0) + 1 into next_number from public.document_processing_runs where document_id = d.id;
  insert into public.document_processing_runs (organization_id, document_id, run_number, provider_code,
    triggered_by, requested_by, organization_rule_snapshot_id, transport_mode, store_remote,
    prompt_version, schema_version, metadata)
  values (p_organization_id, d.id, next_number, 'codex_local', p_triggered_by, p_requested_by,
    p_rule_snapshot_id, 'codex_exec', false, '2026-03-19', '2026-03-19',
    jsonb_build_object('source_document_status', d.status, 'review_required', true)) returning id into result_id;
  update public.documents set status = 'queued', current_processing_run_id = result_id,
    last_rule_snapshot_id = p_rule_snapshot_id,
    metadata = (coalesce(metadata, '{}'::jsonb) - 'processing_error' - 'processing_error_stage') ||
      jsonb_build_object('processing_provider', 'codex_local', 'processing_requested_at', now(), 'review_required', true)
    where id = d.id;
  return result_id;
end $$;

create or replace function public.claim_local_document_processing(p_organization_id uuid, p_worker_id text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare r public.document_processing_runs;
begin
  if length(trim(coalesce(p_worker_id, ''))) not between 1 and 160 then raise exception 'Worker invalido'; end if;
  -- A crashed third attempt becomes a visible recoverable error, never an endless lease.
  with exhausted as (
    update public.document_processing_runs set status = 'error', finished_at = now(),
      failure_stage = 'local_attempts_exhausted', failure_message = 'Se agotaron 3 intentos locales. Revisar y reintentar manualmente.',
      lease_expires_at = null
    where organization_id = p_organization_id and provider_code = 'codex_local'
      and status in ('queued', 'processing') and attempt_count >= 3
      and (lease_expires_at is null or lease_expires_at <= now()) returning id, document_id, failure_message
  ) update public.documents d set status = 'error', metadata = coalesce(d.metadata, '{}'::jsonb)
    || jsonb_build_object('processing_error', e.failure_message, 'processing_error_stage', 'local_attempts_exhausted')
    from exhausted e where d.id = e.document_id and d.current_processing_run_id = e.id
      and d.status in ('queued', 'extracting');
  select q.* into r from public.document_processing_runs q
    join public.documents d on d.id = q.document_id and d.organization_id = q.organization_id
    where q.organization_id = p_organization_id and q.provider_code = 'codex_local'
      and q.status in ('queued', 'processing') and q.attempt_count < 3 and q.available_at <= now()
      and (q.lease_expires_at is null or q.lease_expires_at <= now())
      and d.current_processing_run_id = q.id and d.status in ('queued', 'extracting')
    order by q.created_at for update of q, d skip locked limit 1;
  if not found then return null; end if;
  update public.document_processing_runs set status = 'processing', lease_owner = p_worker_id,
    lease_token = gen_random_uuid(), lease_expires_at = now() + interval '180 seconds',
    started_at = coalesce(started_at, now()), last_polled_at = now(), attempt_count = attempt_count + 1,
    failure_stage = null, failure_message = null
    where id = r.id returning * into r;
  update public.documents set status = 'extracting' where id = r.document_id and current_processing_run_id = r.id;
  return to_jsonb(r);
end $$;

create or replace function public.heartbeat_local_document_processing(
  p_organization_id uuid, p_run_id uuid, p_worker_id text, p_lease_token uuid
) returns boolean language plpgsql security invoker set search_path = public as $$
begin
  update public.document_processing_runs set lease_expires_at = now() + interval '180 seconds', last_polled_at = now()
    where id = p_run_id and organization_id = p_organization_id and provider_code = 'codex_local'
      and status = 'processing' and lease_owner = p_worker_id and lease_token = p_lease_token
      and lease_expires_at > now();
  return found;
end $$;

create or replace function public.fail_local_document_processing(
  p_organization_id uuid, p_run_id uuid, p_worker_id text, p_lease_token uuid,
  p_message text, p_stage text, p_retryable boolean
) returns boolean language plpgsql security invoker set search_path = public as $$
declare r public.document_processing_runs; next_status public.document_processing_run_status;
begin
  select * into r from public.document_processing_runs where id = p_run_id and organization_id = p_organization_id
    and provider_code = 'codex_local' and status = 'processing' and lease_owner = p_worker_id
    and lease_token = p_lease_token and lease_expires_at > now() for update;
  if not found then return false; end if;
  next_status := case when p_retryable and r.attempt_count < 3 then 'queued' else 'error' end;
  update public.document_processing_runs set status = next_status, failure_stage = left(p_stage, 120),
    failure_message = left(p_message, 2000), lease_expires_at = null,
    available_at = now() + interval '30 seconds',
    finished_at = case when next_status = 'error' then now() else null end where id = r.id;
  update public.documents set status = next_status::text::public.document_status,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('processing_error', left(p_message, 2000),
      'processing_error_stage', left(p_stage, 120)) where id = r.document_id and current_processing_run_id = r.id
      and status in ('queued', 'extracting');
  return true;
end $$;

-- One transaction owns fencing, duplicate detection, every artifact and final state.
-- A repeated completion with the same fencing token returns the same draft.
create or replace function public.complete_local_document_processing(
  p_organization_id uuid, p_run_id uuid, p_worker_id text, p_lease_token uuid, p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare r public.document_processing_runs; d public.documents; o jsonb; ident jsonb;
  draft_id uuid := gen_random_uuid(); extraction_id uuid := gen_random_uuid(); revision integer;
  duplicate_id uuid; candidate jsonb; decision jsonb; message text; file_hash_value text;
begin
  perform pg_advisory_xact_lock(hashtextextended('convertilabs-local-completion:' || p_organization_id::text, 0));
  select * into strict r from public.document_processing_runs where id = p_run_id and organization_id = p_organization_id for update;
  if r.provider_code <> 'codex_local' or r.lease_owner is distinct from p_worker_id or r.lease_token is distinct from p_lease_token then
    raise exception 'local_lease_lost';
  end if;
  if r.status in ('completed', 'skipped') then
    return jsonb_build_object('status', case when r.status = 'completed' then 'extracted' else 'skipped' end,
      'draftId', r.metadata->>'draft_id', 'message', r.failure_message);
  end if;
  if r.status <> 'processing' or r.lease_expires_at is null or r.lease_expires_at <= now() then raise exception 'local_lease_lost'; end if;
  select * into strict d from public.documents where id = r.document_id and organization_id = p_organization_id for update;
  if d.current_processing_run_id is distinct from r.id or d.status <> 'extracting'
    or d.posting_status::text in ('posted_provisional', 'posted_final', 'locked') then raise exception 'local_run_superseded'; end if;
  o := p_payload->'output'; ident := coalesce(p_payload->'invoice_identity', '{}'::jsonb);
  file_hash_value := p_payload->>'file_hash';
  if file_hash_value is null or file_hash_value !~ '^[0-9a-f]{64}$' then raise exception 'Hash invalido'; end if;
  if d.file_hash is not null and d.file_hash <> file_hash_value then raise exception 'El archivo no coincide con el hash de la carga original'; end if;
  select id into duplicate_id from public.documents where organization_id = p_organization_id and id <> d.id
    and file_hash = file_hash_value and status::text not in ('duplicate', 'rejected', 'archived') order by created_at limit 1;
  if duplicate_id is null and nullif(ident->>'invoice_identity_key', '') is not null then
    select document_id into duplicate_id from public.document_invoice_identities
      where organization_id = p_organization_id and document_id <> d.id
      and invoice_identity_key = ident->>'invoice_identity_key' and duplicate_status <> 'confirmed_duplicate' limit 1;
  end if;
  if duplicate_id is not null then
    message := 'Documento duplicado de ' || duplicate_id::text || '. No se creo otro borrador.';
    update public.document_processing_runs set status = 'skipped', finished_at = now(), lease_expires_at = null,
      failure_message = message, metadata = metadata || jsonb_build_object('duplicate_of_document_id', duplicate_id)
      where id = r.id;
    update public.documents set status = 'duplicate', file_hash = file_hash_value,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('duplicate_status', 'confirmed_duplicate',
        'duplicate_of_document_id', duplicate_id, 'processing_error', message) where id = d.id;
    return jsonb_build_object('status', 'skipped', 'draftId', null, 'message', message);
  end if;
  if o is null or jsonb_typeof(o) <> 'object' then raise exception 'Extraccion estructurada ausente'; end if;
  select coalesce(max(revision_number), 0) + 1 into revision from public.document_drafts where document_id = d.id;
  update public.document_extractions set is_active = false where document_id = d.id and is_active;
  insert into public.document_extractions (id, document_id, version_no, provider, raw_text, extracted_json, confidence, is_active, created_by)
    values (extraction_id, d.id, r.run_number, 'codex_local:' || coalesce(p_payload->>'model_code', 'codex'),
      o->>'extracted_text', o, (o->>'confidence_score')::numeric, true, r.requested_by);
  insert into public.document_drafts (id, organization_id, document_id, processing_run_id, organization_rule_snapshot_id,
    revision_number, status, document_role, document_type, operation_context_json, intake_context_json,
    fields_json, extracted_text, warnings_json, source_confidence, created_by, updated_by)
    values (draft_id, p_organization_id, d.id, r.id, r.organization_rule_snapshot_id, revision, 'open',
      (o->>'transaction_family_candidate')::public.document_direction, o->>'document_subtype_candidate',
      jsonb_build_object('operation_category_candidate', o->'operation_category_candidate'),
      p_payload->'intake_context', p_payload->'fields', o->>'extracted_text', p_payload->'warnings',
      (o->>'confidence_score')::numeric, r.requested_by, r.requested_by);
  for candidate in select value from jsonb_array_elements(p_payload->'field_candidates') loop
    insert into public.document_field_candidates (organization_id, document_id, processing_run_id, field_name,
      field_value_json, normalized_value_json, extraction_method, confidence)
      values (p_organization_id, d.id, r.id, candidate->>'field_name', candidate->'field_value_json',
        candidate->'normalized_value_json', 'codex_local_structured_response', (o->>'confidence_score')::numeric);
  end loop;
  for candidate in select value from jsonb_array_elements(p_payload->'classification_candidates') loop
    insert into public.document_classification_candidates (organization_id, document_id, processing_run_id,
      candidate_type, candidate_role, candidate_code, explanation, confidence, rank_order)
      values (p_organization_id, d.id, r.id, candidate->>'candidate_type',
        (o->>'transaction_family_candidate')::public.document_direction, candidate->>'candidate_code',
        candidate->>'explanation', (o->>'confidence_score')::numeric, 1);
  end loop;
  for candidate in select value from jsonb_array_elements(p_payload->'steps') loop
    insert into public.document_draft_steps (draft_id, step_code, status, last_saved_at, snapshot_json)
      values (draft_id, candidate->>'step_code', (candidate->>'status')::public.document_draft_step_status,
        (candidate->>'last_saved_at')::timestamptz, candidate->'snapshot_json');
  end loop;
  insert into public.document_revisions (organization_id, document_id, revision_number, working_draft_id, status, opened_by)
    values (p_organization_id, d.id, revision, draft_id, 'open', r.requested_by);
  insert into public.document_invoice_identities (organization_id, document_id, source_draft_id,
    issuer_tax_id_normalized, issuer_name_normalized, document_number_normalized, document_date, total_amount,
    currency_code, identity_strategy, invoice_identity_key, duplicate_status, duplicate_of_document_id, duplicate_reason)
    values (p_organization_id, d.id, draft_id, ident->>'issuer_tax_id_normalized', ident->>'issuer_name_normalized',
      ident->>'document_number_normalized', (ident->>'document_date')::date, (ident->>'total_amount')::numeric,
      ident->>'currency_code', ident->>'identity_strategy', ident->>'invoice_identity_key',
      coalesce(ident->>'duplicate_status', 'clear'), (ident->>'duplicate_of_document_id')::uuid, ident->>'duplicate_reason')
    on conflict (document_id) do update set source_draft_id = excluded.source_draft_id,
      issuer_tax_id_normalized = excluded.issuer_tax_id_normalized, issuer_name_normalized = excluded.issuer_name_normalized,
      document_number_normalized = excluded.document_number_normalized, document_date = excluded.document_date,
      total_amount = excluded.total_amount, currency_code = excluded.currency_code, identity_strategy = excluded.identity_strategy,
      invoice_identity_key = excluded.invoice_identity_key, duplicate_status = excluded.duplicate_status,
      duplicate_of_document_id = excluded.duplicate_of_document_id, duplicate_reason = excluded.duplicate_reason;
  decision := p_payload->'decision_log';
  insert into public.ai_decision_logs (organization_id, document_id, run_type, provider_code, model_code,
    prompt_version, schema_version, decision_source, confidence_score, certainty_level,
    evidence_json, rationale_text, warnings_json, metadata_json)
    values (p_organization_id, d.id, 'document_intake', 'codex_local', p_payload->>'model_code',
      r.prompt_version, r.schema_version, decision->>'decision_source', (decision->>'confidence_score')::numeric,
      decision->>'certainty_level', decision->'evidence_json', decision->>'rationale_text',
      decision->'warnings_json', coalesce(decision->'metadata_json', '{}'::jsonb));
  update public.documents set direction = (o->>'transaction_family_candidate')::public.document_direction,
    document_type = o->>'document_subtype_candidate', status = 'extracted', current_draft_id = draft_id,
    last_rule_snapshot_id = r.organization_rule_snapshot_id, last_processed_at = now(), file_hash = file_hash_value,
    metadata = (coalesce(metadata, '{}'::jsonb) - 'processing_error' - 'processing_error_stage') ||
      jsonb_build_object('processing_provider', 'codex_local', 'processing_model', p_payload->>'model_code',
        'review_required', true, 'warning_count', jsonb_array_length(p_payload->'warnings'),
        'line_item_count', jsonb_array_length(o->'line_items')) where id = d.id;
  update public.document_processing_runs set status = 'completed', finished_at = now(), lease_expires_at = null,
    model_code = p_payload->>'model_code', latency_ms = (p_payload->>'latency_ms')::integer,
    input_tokens = (p_payload->'usage'->>'inputTokens')::integer,
    output_tokens = (p_payload->'usage'->>'outputTokens')::integer,
    total_tokens = (p_payload->'usage'->>'totalTokens')::integer,
    provider_status = 'completed', provider_response_json = jsonb_build_object('output', o, 'diagnostics', p_payload->'diagnostics'),
    failure_stage = null, failure_message = null,
    metadata = metadata || jsonb_build_object('draft_id', draft_id, 'extraction_id', extraction_id,
      'file_hash', file_hash_value, 'review_required', true, 'billing_source', 'chatgpt_subscription') where id = r.id;
  return jsonb_build_object('status', 'extracted', 'draftId', draft_id);
end $$;

revoke all on function public.enqueue_local_document_processing(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.claim_local_document_processing(uuid, text) from public, anon, authenticated;
revoke all on function public.heartbeat_local_document_processing(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.fail_local_document_processing(uuid, uuid, text, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.complete_local_document_processing(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_local_document_processing(uuid, uuid, uuid, text, uuid) to service_role;
grant execute on function public.claim_local_document_processing(uuid, text) to service_role;
grant execute on function public.heartbeat_local_document_processing(uuid, uuid, text, uuid) to service_role;
grant execute on function public.fail_local_document_processing(uuid, uuid, text, uuid, text, text, boolean) to service_role;
grant execute on function public.complete_local_document_processing(uuid, uuid, text, uuid, jsonb) to service_role;
