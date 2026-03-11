do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_storage_path_key'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_storage_path_key unique (storage_path);
  end if;
end
$$;

create index if not exists idx_documents_uploaded_by
  on public.documents (uploaded_by);

create index if not exists idx_documents_status
  on public.documents (status);

create index if not exists idx_documents_org_created_at
  on public.documents (organization_id, created_at desc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'documents-private',
  'documents-private',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.sanitize_document_filename(p_original_filename text)
returns text
language sql
immutable
set search_path = public
as $$
  with normalized as (
    select lower(
      regexp_replace(
        regexp_replace(
          translate(
            coalesce(nullif(regexp_replace(p_original_filename, '^.*[\\/]', ''), ''), 'document'),
            U&'\00E1\00E0\00E4\00E2\00E3\00E5\00E9\00E8\00EB\00EA\00ED\00EC\00EF\00EE\00F3\00F2\00F6\00F4\00F5\00FA\00F9\00FC\00FB\00F1\00E7',
            'aaaaaaeeeeiiiiooooouuuunc'
          ),
          '[^a-zA-Z0-9._-]+',
          '-',
          'g'
        ),
        '-{2,}',
        '-',
        'g'
      )
    ) as value
  )
  select coalesce(
    nullif(trim(both '-._' from value), ''),
    'document'
  )
  from normalized;
$$;

create or replace function public.build_document_storage_path(
  p_org_id uuid,
  p_document_id uuid,
  p_original_filename text
)
returns text
language sql
immutable
set search_path = public
as $$
  select format(
    'orgs/%s/%s/%s',
    p_org_id,
    p_document_id,
    public.sanitize_document_filename(p_original_filename)
  );
$$;

create or replace function public.document_storage_org_id(p_object_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when array_length(storage.foldername(p_object_name), 1) >= 3
      and (storage.foldername(p_object_name))[1] = 'orgs'
      and (storage.foldername(p_object_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_object_name))[2])::uuid
    else null
  end;
$$;

create or replace function public.can_access_document_storage_object(
  p_bucket_id text,
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documents as d
    where d.storage_bucket = p_bucket_id
      and d.storage_path = p_object_name
      and d.organization_id = public.document_storage_org_id(p_object_name)
      and public.is_org_member(d.organization_id)
  );
$$;

create or replace function public.can_upload_document_storage_object(
  p_bucket_id text,
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documents as d
    where d.storage_bucket = p_bucket_id
      and d.storage_path = p_object_name
      and d.organization_id = public.document_storage_org_id(p_object_name)
      and d.uploaded_by = auth.uid()
      and public.is_org_member(d.organization_id)
      and d.status = 'uploading'::public.document_status
  );
$$;

create or replace function public.prepare_document_upload(
  p_org_id uuid,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_direction public.document_direction default 'purchase'
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
    p_direction,
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

create or replace function public.complete_document_upload(
  p_document_id uuid
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  update public.documents as d
  set
    status = 'uploaded'::public.document_status,
    updated_at = now(),
    metadata = d.metadata - 'upload_error'
  where d.id = p_document_id
    and d.uploaded_by = auth.uid()
    and public.is_org_member(d.organization_id)
  returning d.* into v_document;

  if v_document.id is null then
    raise exception 'Document upload could not be finalized.'
      using errcode = '42501';
  end if;

  return v_document;
end;
$$;

create or replace function public.fail_document_upload(
  p_document_id uuid,
  p_error_message text default null
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  update public.documents as d
  set
    status = 'error'::public.document_status,
    updated_at = now(),
    metadata = d.metadata || jsonb_build_object(
      'upload_error',
      coalesce(nullif(trim(p_error_message), ''), 'Upload failed')
    )
  where d.id = p_document_id
    and d.uploaded_by = auth.uid()
    and public.is_org_member(d.organization_id)
  returning d.* into v_document;

  if v_document.id is null then
    raise exception 'Document upload could not be marked as failed.'
      using errcode = '42501';
  end if;

  return v_document;
end;
$$;

revoke all on function public.prepare_document_upload(uuid, text, text, bigint, public.document_direction) from public;
grant execute on function public.prepare_document_upload(uuid, text, text, bigint, public.document_direction) to authenticated;
grant execute on function public.prepare_document_upload(uuid, text, text, bigint, public.document_direction) to service_role;

revoke all on function public.complete_document_upload(uuid) from public;
grant execute on function public.complete_document_upload(uuid) to authenticated;
grant execute on function public.complete_document_upload(uuid) to service_role;

revoke all on function public.fail_document_upload(uuid, text) from public;
grant execute on function public.fail_document_upload(uuid, text) to authenticated;
grant execute on function public.fail_document_upload(uuid, text) to service_role;

do $$
begin
  if exists (
    select 1
    from pg_class as c
    join pg_namespace as n
      on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
      and pg_get_userbyid(c.relowner) = current_user
  ) then
    execute 'alter table storage.objects enable row level security';
    execute 'drop policy if exists "storage_documents_private_select_member" on storage.objects';
    execute '
      create policy "storage_documents_private_select_member"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = ''documents-private''
        and public.can_access_document_storage_object(bucket_id, name)
      )
    ';
    execute 'drop policy if exists "storage_documents_private_insert_uploader" on storage.objects';
    execute '
      create policy "storage_documents_private_insert_uploader"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = ''documents-private''
        and public.can_upload_document_storage_object(bucket_id, name)
      )
    ';
  else
    raise notice 'Skipping storage.objects policies because current role % does not own storage.objects.', current_user;
  end if;
end
$$;
