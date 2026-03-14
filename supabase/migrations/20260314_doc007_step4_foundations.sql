alter type public.document_direction add value if not exists 'unknown';

alter table public.documents
  alter column direction set default 'unknown'::public.document_direction;

update public.documents
set
  direction = 'unknown'::public.document_direction,
  updated_at = now()
where direction = 'purchase'::public.document_direction
  and current_draft_id is null
  and status in (
    'uploading'::public.document_status,
    'uploaded'::public.document_status,
    'queued'::public.document_status,
    'extracting'::public.document_status
  );

create or replace function public.prepare_document_upload(
  p_org_id uuid,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_direction public.document_direction default 'unknown'
)
returns table (
  document_id uuid,
  storage_bucket text,
  storage_path text,
  status public.document_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_original_filename text := coalesce(nullif(trim(regexp_replace(p_original_filename, '^.*[\\/]', '')), ''), 'document');
  v_document_id uuid := gen_random_uuid();
  v_storage_path text;
begin
  if auth.role() <> 'authenticated' or v_user_id is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not public.is_org_member(p_org_id) then
    raise exception 'Not allowed to upload documents for this organization.'
      using errcode = '42501';
  end if;

  if p_mime_type not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Unsupported document MIME type.'
      using errcode = '22023';
  end if;

  if p_file_size is null or p_file_size <= 0 then
    raise exception 'Document file size must be greater than zero.'
      using errcode = '22023';
  end if;

  if p_file_size > 20971520 then
    raise exception 'Document file size exceeds the 20 MB limit.'
      using errcode = '22023';
  end if;

  v_storage_path := public.build_document_storage_path(
    p_org_id,
    v_document_id,
    v_original_filename
  );

  insert into public.documents (
    id,
    organization_id,
    direction,
    status,
    storage_bucket,
    storage_path,
    original_filename,
    mime_type,
    file_size,
    uploaded_by
  )
  values (
    v_document_id,
    p_org_id,
    coalesce(p_direction, 'unknown'::public.document_direction),
    'uploading'::public.document_status,
    'documents-private',
    v_storage_path,
    v_original_filename,
    p_mime_type,
    p_file_size,
    v_user_id
  );

  document_id := v_document_id;
  storage_bucket := 'documents-private';
  storage_path := v_storage_path;
  status := 'uploading'::public.document_status;

  return next;
end;
$$;

alter table public.document_drafts
  add column if not exists intake_context_json jsonb not null default '{}'::jsonb;
