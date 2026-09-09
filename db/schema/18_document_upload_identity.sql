-- Shared identity for byte-identical invoice uploads across browser, mobile and PCs.
-- No existing document is modified and no unique hash index is imposed on history.
create or replace function public.document_upload_identity(p_org_id uuid, p_file_hash text)
returns uuid language plpgsql immutable strict set search_path = public as $$
declare h text;
begin
  if p_file_hash !~ '^[0-9a-f]{64}$' then raise exception 'SHA-256 invalido' using errcode = '22023'; end if;
  h := substr(encode(sha256(convert_to('convertilabs:local-document:v1:' || p_org_id::text || ':' || p_file_hash, 'UTF8')), 'hex'), 1, 32);
  h := overlay(h placing '8' from 13 for 1);
  h := overlay(h placing to_hex((('x' || substr(h, 17, 1))::bit(4)::integer & 3) | 8) from 17 for 1);
  return h::uuid;
end $$;

create or replace function public.prepare_document_upload_with_hash(
  p_org_id uuid, p_original_filename text, p_mime_type text, p_file_size bigint,
  p_file_hash text, p_processing_provider text default 'codex_local', p_source_surface text default 'web'
) returns table(document_id uuid, storage_bucket text, storage_path text, status public.document_status, is_duplicate boolean,
  upload_state text, upload_lease_token uuid)
language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := auth.uid(); d public.documents; reserved_id uuid; lease_token uuid := gen_random_uuid();
  filename text := coalesce(nullif(trim(regexp_replace(p_original_filename, '^.*[\\/]', '')), ''), 'document');
begin
  if auth.role() <> 'authenticated' or actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists(select 1 from public.organization_members m where m.organization_id = p_org_id and m.user_id = actor
    and m.is_active = true and m.role::text in ('owner','admin','admin_processing','accountant','reviewer','operator','developer')) then
    raise exception 'Not allowed to upload documents for this organization' using errcode = '42501';
  end if;
  if p_file_hash is null or p_file_hash !~ '^[0-9a-f]{64}$' or p_mime_type is null or p_mime_type not in ('application/pdf','image/jpeg','image/png')
    or p_file_size is null or p_file_size <= 0 or p_file_size > 20971520
    or p_processing_provider is null or p_processing_provider not in ('codex_local','openai')
    or p_source_surface is null or p_source_surface not in ('web','mobile_field') then
    raise exception 'Invalid invoice upload metadata or SHA-256' using errcode = '22023';
  end if;
  reserved_id := public.document_upload_identity(p_org_id, p_file_hash);
  perform pg_advisory_xact_lock(hashtextextended('convertilabs-upload:' || p_org_id::text || ':' || p_file_hash, 0));
  select * into d from public.documents where organization_id = p_org_id and file_hash = p_file_hash order by created_at, id limit 1 for update;
  is_duplicate := d.id is not null;
  upload_state := 'existing';
  if d.id is null then
    insert into public.documents(id, organization_id, direction, status, storage_bucket, storage_path,
      original_filename, mime_type, file_size, file_hash, uploaded_by, upload_source, source_type, metadata)
    values(reserved_id, p_org_id, 'unknown', 'uploading', 'documents-private',
      p_org_id::text || '/' || reserved_id::text || '/' || filename,
      filename, p_mime_type, p_file_size, p_file_hash, actor, p_source_surface, 'manual_upload',
      jsonb_build_object('processing_provider', p_processing_provider, 'source_surface', p_source_surface, 'source_file_sha256', p_file_hash,
        'upload_lease_token', lease_token, 'upload_lease_expires_at', now() + interval '5 minutes'))
    on conflict (id) do nothing returning * into d;
    if d.id is null then
      -- The local CLI uses the same primary key. A simultaneous CLI insert wins once.
      select * into d from public.documents where id = reserved_id and organization_id = p_org_id and file_hash = p_file_hash;
      if d.id is null then raise exception 'Upload identity conflict'; end if;
      is_duplicate := true;
    else
      upload_state := 'upload'; upload_lease_token := lease_token;
    end if;
  end if;
  if is_duplicate and d.uploaded_by = actor and d.current_processing_run_id is null and d.current_draft_id is null
    and d.status::text in ('uploading','uploaded','error') and not (d.metadata ? 'local_upload_token') then
    if d.status::text = 'uploading' and d.metadata->>'upload_lease_expires_at' is not null
      and (d.metadata->>'upload_lease_expires_at')::timestamptz > now() then
      upload_state := 'busy';
    else
      update public.documents set status = 'uploading', updated_at = now(), metadata = metadata || jsonb_build_object(
        'upload_lease_token', lease_token, 'upload_lease_expires_at', now() + interval '5 minutes')
        where id = d.id returning * into d;
      upload_state := 'resume'; upload_lease_token := lease_token;
    end if;
  end if;
  document_id := d.id; storage_bucket := d.storage_bucket; storage_path := d.storage_path; status := d.status;
  return next;
end $$;

-- Old clients must update instead of creating a document without its file identity.
create or replace function public.prepare_document_upload(
  p_org_id uuid, p_original_filename text, p_mime_type text, p_file_size bigint,
  p_direction public.document_direction default 'unknown'
) returns table(document_id uuid, storage_bucket text, storage_path text, status public.document_status)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  raise exception 'Actualiza Convertilabs: la carga requiere SHA-256 y prepare_document_upload_with_hash' using errcode = '22023';
end $$;

-- Repeated/later upload callbacks cannot reset an already queued, reviewed or posted invoice.
create or replace function public.complete_document_upload(p_document_id uuid)
returns public.documents language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.documents;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into d from public.documents where id = p_document_id and uploaded_by = auth.uid()
    and public.is_org_member(organization_id) for update;
  if d.id is null then raise exception 'Document upload could not be finalized' using errcode = '42501'; end if;
  if d.status::text = 'uploading' and d.current_draft_id is null and d.current_processing_run_id is null and not (d.metadata ? 'upload_lease_token') then
    update public.documents set status = 'uploaded', updated_at = now(), metadata = metadata - 'upload_error'
      where id = d.id returning * into d;
  end if;
  return d;
end $$;

create or replace function public.fail_document_upload(p_document_id uuid, p_error_message text default null)
returns public.documents language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.documents;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into d from public.documents where id = p_document_id and uploaded_by = auth.uid()
    and public.is_org_member(organization_id) for update;
  if d.id is null then raise exception 'Document upload could not be marked as failed' using errcode = '42501'; end if;
  if d.status::text = 'uploading' and d.current_draft_id is null and d.current_processing_run_id is null and not (d.metadata ? 'upload_lease_token') then
    update public.documents set status = 'error', updated_at = now(), metadata = metadata || jsonb_build_object(
      'upload_error', coalesce(nullif(trim(p_error_message), ''), 'Upload failed')) where id = d.id returning * into d;
  end if;
  return d;
end $$;

create or replace function public.finish_document_upload_with_lease(p_document_id uuid, p_upload_lease_token uuid,
  p_error_message text default null)
returns public.documents language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.documents;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into d from public.documents where id = p_document_id and uploaded_by = auth.uid()
    and exists(select 1 from public.organization_members m where m.organization_id = documents.organization_id
      and m.user_id = auth.uid() and m.is_active = true
      and m.role::text in ('owner','admin','admin_processing','accountant','reviewer','operator','developer')) for update;
  if d.id is null or p_upload_lease_token is null or d.metadata->>'upload_lease_token' is distinct from p_upload_lease_token::text then
    raise exception 'La reserva de esta carga cambio. Volve a abrir el documento existente.' using errcode = '42501';
  end if;
  if d.status::text = 'uploading' and d.current_draft_id is null and d.current_processing_run_id is null then
    update public.documents set status = case when p_error_message is null then 'uploaded'::public.document_status else 'error'::public.document_status end,
      updated_at = now(), metadata = case when p_error_message is null then metadata - 'upload_error'
        else metadata || jsonb_build_object('upload_error', left(p_error_message, 500)) end
      where id = d.id returning * into d;
  end if;
  return d;
end $$;

revoke all on function public.prepare_document_upload_with_hash(uuid,text,text,bigint,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.prepare_document_upload_with_hash(uuid,text,text,bigint,text,text,text) to authenticated;
revoke all on function public.finish_document_upload_with_lease(uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.finish_document_upload_with_lease(uuid,uuid,text) to authenticated;

-- A delayed upload acknowledgement must not become a new extraction after the first one completed.
create or replace function public.enqueue_local_document_upload_once(
  p_organization_id uuid, p_document_id uuid, p_requested_by uuid,
  p_triggered_by text, p_rule_snapshot_id uuid
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare d public.documents;
begin
  select * into strict d from public.documents where id = p_document_id and organization_id = p_organization_id for update;
  if d.current_processing_run_id is not null then return d.current_processing_run_id; end if;
  if d.current_draft_id is not null or d.status::text <> 'uploaded' then
    raise exception 'La carga no admite una nueva extraccion automatica; revisa el documento existente';
  end if;
  return public.enqueue_local_document_processing(p_organization_id, p_document_id, p_requested_by, 'upload', p_rule_snapshot_id);
end $$;
revoke all on function public.enqueue_local_document_upload_once(uuid,uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.enqueue_local_document_upload_once(uuid,uuid,uuid,text,uuid) to service_role;
