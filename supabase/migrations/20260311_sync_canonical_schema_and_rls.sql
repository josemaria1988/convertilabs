-- Generated from db/ canonical SQL. Do not edit manually.
-- Regenerate with: npm run db:generate:migration

-- >>> db/schema/00_extensions.sql
create extension if not exists pgcrypto;
-- <<< db/schema/00_extensions.sql

-- >>> db/schema/01_enums.sql
do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'member_role'
  ) then
    create type public.member_role as enum (
  'owner',
  'admin',
  'accountant',
  'reviewer',
  'operator',
  'developer',
  'viewer'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_direction'
  ) then
    create type public.document_direction as enum ('purchase', 'sale', 'other');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_status'
  ) then
    create type public.document_status as enum (
  'uploaded',
  'queued',
  'extracting',
  'extracted',
  'draft_ready',
  'classified',
  'classified_with_open_revision',
  'needs_review',
  'approved',
  'rejected',
  'duplicate',
  'archived',
  'uploading',
  'error'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'suggestion_status'
  ) then
    create type public.suggestion_status as enum (
  'drafted',
  'needs_review',
  'ready_for_review',
  'approved',
  'rejected',
  'superseded'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'organization_profile_status'
  ) then
    create type public.organization_profile_status as enum (
  'draft',
  'active',
  'superseded'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'organization_rule_snapshot_status'
  ) then
    create type public.organization_rule_snapshot_status as enum (
  'draft',
  'active',
  'superseded'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_processing_run_status'
  ) then
    create type public.document_processing_run_status as enum (
  'queued',
  'processing',
  'completed',
  'error',
  'skipped'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_draft_status'
  ) then
    create type public.document_draft_status as enum (
  'open',
  'ready_for_confirmation',
  'confirmed',
  'superseded'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_draft_step_status'
  ) then
    create type public.document_draft_step_status as enum (
  'not_started',
  'draft_saved',
  'confirmed',
  'stale_after_upstream_change',
  'blocked',
  'error'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_revision_status'
  ) then
    create type public.document_revision_status as enum (
  'open',
  'pending_reconfirmation',
  'reconfirmed',
  'superseded'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_confirmation_type'
  ) then
    create type public.document_confirmation_type as enum (
  'final',
  'reconfirmation'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'normative_update_run_status'
  ) then
    create type public.normative_update_run_status as enum (
  'queued',
  'processing',
  'completed',
  'error'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'entry_status'
  ) then
    create type public.entry_status as enum (
  'draft',
  'reviewed',
  'posted',
  'exported',
  'void'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'tax_type'
  ) then
    create type public.tax_type as enum ('VAT', 'IRAE', 'IP');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'tax_period_status'
  ) then
    create type public.tax_period_status as enum (
  'open',
  'review',
  'closed',
  'locked'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'export_status'
  ) then
    create type public.export_status as enum (
  'queued',
  'generating',
  'generated',
  'downloaded',
  'failed',
  'expired'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'rule_scope'
  ) then
    create type public.rule_scope as enum ('global', 'package', 'organization');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'account_type'
  ) then
    create type public.account_type as enum (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
  'memo'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'normal_side'
  ) then
    create type public.normal_side as enum ('debit', 'credit');
  end if;
end
$$;
-- <<< db/schema/01_enums.sql

-- >>> db/schema/02_identity_and_tenants.sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_email
  on public.profiles (email);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country_code text not null default 'UY',
  base_currency text not null default 'UYU',
  legal_entity_type text,
  tax_id text,
  tax_regime_code text,
  vat_regime text,
  dgi_group text,
  cfe_status text,
  default_locale text not null default 'es-UY',
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_organization_members_user_id
  on public.organization_members (user_id);

create index if not exists idx_organization_members_organization_id
  on public.organization_members (organization_id);

drop function if exists public.sync_profile_from_auth_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;

create or replace function public.is_org_member(p_org_id uuid)
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

create or replace function public.is_org_owner(p_org_id uuid)
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
      and om.role = 'owner'::public.member_role
  );
$$;

create or replace function public.slugify_organization_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(
    both '-'
    from regexp_replace(
      regexp_replace(
        translate(
          lower(coalesce(p_name, '')),
          U&'\00E1\00E0\00E4\00E2\00E3\00E5\00E9\00E8\00EB\00EA\00ED\00EC\00EF\00EE\00F3\00F2\00F6\00F4\00F5\00FA\00F9\00FC\00FB\00F1\00E7',
          'aaaaaaeeeeiiiiooooouuuunc'
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-{2,}',
      '-',
      'g'
    )
  );
$$;

create or replace function public.create_organization_with_owner(
  p_name text,
  p_legal_entity_type text default null,
  p_tax_id text default null,
  p_tax_regime_code text default null,
  p_vat_regime text default null,
  p_dgi_group text default null,
  p_cfe_status text default null
)
returns table (organization_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_name text;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 0;
  v_organization_id uuid;
begin
  if auth.role() <> 'authenticated' or v_user_id is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  v_normalized_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');

  if char_length(v_normalized_name) < 2 then
    raise exception 'Organization name must contain at least 2 characters.'
      using errcode = '22023';
  end if;

  if char_length(v_normalized_name) > 120 then
    raise exception 'Organization name must contain at most 120 characters.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_legal_entity_type, '')), '') is null then
    raise exception 'Organization legal entity type is required.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_tax_id, '')), '') is null then
    raise exception 'Organization tax id is required.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_tax_regime_code, '')), '') is null then
    raise exception 'Organization tax regime code is required.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_vat_regime, '')), '') is null then
    raise exception 'Organization vat regime is required.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_dgi_group, '')), '') is null then
    raise exception 'Organization dgi group is required.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_cfe_status, '')), '') is null then
    raise exception 'Organization cfe status is required.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = v_user_id
  ) then
    raise exception 'Profile missing for authenticated user.'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.organization_members as om
    where om.user_id = v_user_id
      and om.is_active = true
  ) then
    raise exception 'User already belongs to an active organization.'
      using errcode = 'P0001';
  end if;

  v_base_slug := public.slugify_organization_name(v_normalized_name);

  if v_base_slug = '' then
    raise exception 'Organization name must include letters or numbers.'
      using errcode = '22023';
  end if;

  v_slug := v_base_slug;

  loop
    exit when not exists (
      select 1
      from public.organizations as o
      where o.slug = v_slug
    );

    v_suffix := v_suffix + 1;
    v_slug := format('%s-%s', v_base_slug, v_suffix);
  end loop;

  insert into public.organizations (
    name,
    slug,
    legal_entity_type,
    tax_id,
    tax_regime_code,
    vat_regime,
    dgi_group,
    cfe_status,
    created_by
  )
  values (
    v_normalized_name,
    v_slug,
    trim(p_legal_entity_type),
    trim(p_tax_id),
    trim(p_tax_regime_code),
    trim(p_vat_regime),
    trim(p_dgi_group),
    trim(p_cfe_status),
    v_user_id
  )
  returning id into v_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role
  )
  values (
    v_organization_id,
    v_user_id,
    'owner'::public.member_role
  );

  organization_id := v_organization_id;
  slug := v_slug;

  return next;
end;
$$;

create or replace function public.create_organization_with_owner(
  p_name text,
  p_legal_entity_type text default null,
  p_tax_id text default null,
  p_tax_regime_code text default null
)
returns table (organization_id uuid, slug text)
language sql
security definer
set search_path = public
as $$
  select *
  from public.create_organization_with_owner(
    p_name,
    p_legal_entity_type,
    p_tax_id,
    p_tax_regime_code,
    'UNKNOWN',
    'UNKNOWN',
    'UNKNOWN'
  );
$$;

revoke all on function public.create_organization_with_owner(text, text, text, text) from public;
revoke all on function public.create_organization_with_owner(text, text, text, text, text, text, text) from public;
grant execute on function public.create_organization_with_owner(text, text, text, text) to authenticated;
grant execute on function public.create_organization_with_owner(text, text, text, text) to service_role;
grant execute on function public.create_organization_with_owner(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_organization_with_owner(text, text, text, text, text, text, text) to service_role;
-- <<< db/schema/02_identity_and_tenants.sql

-- >>> db/schema/03_master_data.sql
create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  account_type public.account_type not null,
  normal_side public.normal_side not null,
  is_postable boolean not null default true,
  parent_id uuid references public.chart_of_accounts(id),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  default_account_id uuid references public.chart_of_accounts(id),
  default_payment_account_id uuid references public.chart_of_accounts(id),
  default_tax_profile jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- <<< db/schema/03_master_data.sql

-- >>> db/schema/04_documents.sql
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  direction public.document_direction not null default 'purchase',
  document_type text,
  status public.document_status not null default 'uploaded',
  storage_bucket text not null default 'documents-private',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text,
  file_size bigint,
  file_hash text,
  upload_source text not null default 'web',
  uploaded_by uuid references public.profiles(id),
  document_date date,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_org_status
  on public.documents (organization_id, status);

create index if not exists idx_documents_file_hash
  on public.documents (organization_id, file_hash);

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

create table if not exists public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_no integer not null,
  provider text,
  raw_text text,
  extracted_json jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  is_active boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (document_id, version_no)
);

create index if not exists idx_document_extractions_active
  on public.document_extractions (document_id, is_active);

create table if not exists public.document_relations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid not null references public.documents(id) on delete cascade,
  target_document_id uuid references public.documents(id) on delete cascade,
  relation_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

create or replace function public.list_dashboard_documents(
  p_org_id uuid,
  p_limit integer default 12
)
returns table (
  id uuid,
  original_filename text,
  status public.document_status,
  created_at timestamptz,
  uploaded_by_display text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 50));
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not public.is_org_member(p_org_id) then
    raise exception 'Not allowed to access this organization.'
      using errcode = '42501';
  end if;

  return query
  select
    d.id,
    d.original_filename,
    d.status,
    d.created_at,
    coalesce(
      nullif(p.full_name, ''),
      nullif(p.email, ''),
      'Usuario sin perfil'
    ) as uploaded_by_display
  from public.documents as d
  left join public.profiles as p
    on p.id = d.uploaded_by
  where d.organization_id = p_org_id
  order by d.created_at desc
  limit v_limit;
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

revoke all on function public.list_dashboard_documents(uuid, integer) from public;
grant execute on function public.list_dashboard_documents(uuid, integer) to authenticated;
grant execute on function public.list_dashboard_documents(uuid, integer) to service_role;
-- <<< db/schema/04_documents.sql

-- >>> db/schema/05_accounting.sql
create table if not exists public.accounting_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  extraction_id uuid references public.document_extractions(id) on delete set null,
  version_no integer not null,
  status public.suggestion_status not null default 'drafted',
  confidence numeric(5,4),
  explanation text,
  tax_treatment_json jsonb not null default '{}'::jsonb,
  rule_trace_json jsonb not null default '[]'::jsonb,
  generated_by text not null default 'system',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, version_no)
);

create index if not exists idx_accounting_suggestions_org_doc
  on public.accounting_suggestions (organization_id, document_id);

create table if not exists public.accounting_suggestion_lines (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.accounting_suggestions(id) on delete cascade,
  line_no integer not null,
  side public.normal_side not null,
  account_id uuid not null references public.chart_of_accounts(id),
  amount numeric(18,2) not null,
  tax_tag text,
  memo text,
  metadata jsonb not null default '{}'::jsonb,
  unique (suggestion_id, line_no)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid references public.documents(id) on delete set null,
  source_suggestion_id uuid references public.accounting_suggestions(id) on delete set null,
  entry_date date not null,
  period_id uuid,
  status public.entry_status not null default 'draft',
  currency_code text not null default 'UYU',
  reference text,
  description text,
  total_debit numeric(18,2) not null default 0,
  total_credit numeric(18,2) not null default 0,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journal_entries_org_date
  on public.journal_entries (organization_id, entry_date);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  line_no integer not null,
  account_id uuid not null references public.chart_of_accounts(id),
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  tax_tag text,
  vendor_id uuid references public.vendors(id),
  customer_id uuid references public.customers(id),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  unique (journal_entry_id, line_no)
);
-- <<< db/schema/05_accounting.sql

-- >>> db/schema/06_tax_and_rules.sql
create table if not exists public.normative_packages (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'UY',
  tax_type public.tax_type not null,
  package_year integer not null,
  name text not null,
  status text not null default 'active',
  effective_from date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (country_code, tax_type, package_year, name)
);

create table if not exists public.normative_documents (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.normative_packages(id) on delete cascade,
  title text not null,
  document_type text,
  source_reference text,
  storage_bucket text not null default 'normative-private',
  storage_path text,
  extracted_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  package_id uuid references public.normative_packages(id) on delete cascade,
  tax_type public.tax_type not null,
  scope public.rule_scope not null,
  name text not null,
  priority integer not null default 0,
  active boolean not null default true,
  valid_from date,
  valid_to date,
  conditions_json jsonb not null default '[]'::jsonb,
  effects_json jsonb not null default '[]'::jsonb,
  source_reference text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_tax_rules_scope_active
  on public.tax_rules (tax_type, scope, active);

create table if not exists public.tax_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tax_type public.tax_type not null,
  period_year integer not null,
  period_month integer,
  start_date date not null,
  end_date date not null,
  status public.tax_period_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tax_type, period_year, period_month)
);

create table if not exists public.vat_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.tax_periods(id) on delete cascade,
  status text not null default 'draft',
  input_snapshot_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  output_vat numeric(18,2) not null default 0,
  input_vat_creditable numeric(18,2) not null default 0,
  input_vat_non_deductible numeric(18,2) not null default 0,
  adjustments numeric(18,2) not null default 0,
  net_vat_payable numeric(18,2) not null default 0,
  version_no integer not null default 1,
  created_by uuid references public.profiles(id),
  finalized_by uuid references public.profiles(id),
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);
-- <<< db/schema/06_tax_and_rules.sql

-- >>> db/schema/07_integrations_and_audit.sql
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  export_type text not null,
  target_system text not null,
  status public.export_status not null default 'queued',
  storage_bucket text not null default 'exports-private',
  storage_path text,
  payload_json jsonb not null default '{}'::jsonb,
  checksum text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  api_client_id uuid not null references public.api_clients(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  endpoint_url text not null,
  secret_hash text not null,
  events text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_org_created
  on public.audit_log (organization_id, created_at desc);
-- <<< db/schema/07_integrations_and_audit.sql

-- >>> db/schema/08_document_ai_pipeline.sql
create table if not exists public.organization_profile_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_number integer not null,
  status public.organization_profile_status not null default 'draft',
  effective_from date not null,
  effective_to date,
  legal_entity_type text not null,
  tax_regime_code text not null,
  country_code text not null default 'UY',
  tax_id text not null,
  profile_summary text,
  profile_json jsonb not null default '{}'::jsonb,
  change_reason text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (organization_id, version_number)
);

create index if not exists idx_org_profile_versions_org_effective
  on public.organization_profile_versions (organization_id, effective_from desc);

create table if not exists public.organization_rule_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_version_id uuid references public.organization_profile_versions(id) on delete set null,
  version_number integer not null,
  status public.organization_rule_snapshot_status not null default 'draft',
  scope_code text not null default 'vat_document_intake',
  effective_from date not null,
  effective_to date,
  legal_entity_type text not null,
  tax_regime_code text not null,
  country_code text not null default 'UY',
  prompt_summary text not null,
  rules_json jsonb not null default '[]'::jsonb,
  deterministic_rule_refs_json jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (organization_id, version_number)
);

create index if not exists idx_org_rule_snapshots_org_effective
  on public.organization_rule_snapshots (organization_id, effective_from desc);

create table if not exists public.document_processing_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  run_number integer not null,
  status public.document_processing_run_status not null default 'queued',
  provider_code text not null default 'openai',
  model_code text,
  triggered_by text not null default 'manual',
  requested_by uuid references public.profiles(id),
  organization_rule_snapshot_id uuid references public.organization_rule_snapshots(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  openai_file_id text,
  failure_stage text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  provider_response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, run_number)
);

create index if not exists idx_document_processing_runs_doc_created
  on public.document_processing_runs (document_id, created_at desc);

create table if not exists public.document_field_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  processing_run_id uuid not null references public.document_processing_runs(id) on delete cascade,
  field_name text not null,
  field_value_json jsonb not null default '{}'::jsonb,
  normalized_value_json jsonb not null default '{}'::jsonb,
  source_page integer,
  source_bbox_json jsonb not null default '{}'::jsonb,
  extraction_method text,
  confidence numeric(5,4),
  created_at timestamptz not null default now()
);

create index if not exists idx_document_field_candidates_doc
  on public.document_field_candidates (document_id, field_name);

create table if not exists public.document_classification_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  processing_run_id uuid not null references public.document_processing_runs(id) on delete cascade,
  candidate_type text not null,
  candidate_role public.document_direction,
  candidate_code text,
  explanation text,
  confidence numeric(5,4),
  rank_order integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_classification_candidates_doc
  on public.document_classification_candidates (document_id, candidate_type, rank_order);

create table if not exists public.document_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  processing_run_id uuid references public.document_processing_runs(id) on delete set null,
  organization_rule_snapshot_id uuid references public.organization_rule_snapshots(id) on delete set null,
  revision_number integer not null,
  status public.document_draft_status not null default 'open',
  document_role public.document_direction not null default 'other',
  document_type text,
  operation_context_json jsonb not null default '{}'::jsonb,
  fields_json jsonb not null default '{}'::jsonb,
  extracted_text text,
  warnings_json jsonb not null default '[]'::jsonb,
  journal_suggestion_json jsonb not null default '{}'::jsonb,
  tax_treatment_json jsonb not null default '{}'::jsonb,
  source_confidence numeric(5,4),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (document_id, revision_number)
);

create index if not exists idx_document_drafts_doc_updated
  on public.document_drafts (document_id, updated_at desc);

create table if not exists public.document_draft_steps (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  step_code text not null,
  status public.document_draft_step_status not null default 'not_started',
  last_saved_at timestamptz,
  last_confirmed_at timestamptz,
  stale_reason text,
  snapshot_json jsonb not null default '{}'::jsonb,
  unique (draft_id, step_code)
);

create table if not exists public.document_draft_autosaves (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  step_code text not null,
  payload_patch_json jsonb not null default '{}'::jsonb,
  saved_by uuid references public.profiles(id),
  saved_at timestamptz not null default now()
);

create index if not exists idx_document_draft_autosaves_draft_saved
  on public.document_draft_autosaves (draft_id, saved_at desc);

create table if not exists public.document_confirmations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  confirmation_type public.document_confirmation_type not null,
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz not null default now(),
  snapshot_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_document_confirmations_doc
  on public.document_confirmations (document_id, confirmed_at desc);

create table if not exists public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  revision_number integer not null,
  base_confirmed_draft_id uuid references public.document_drafts(id) on delete set null,
  working_draft_id uuid references public.document_drafts(id) on delete set null,
  status public.document_revision_status not null default 'open',
  opened_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  reconfirmed_by uuid references public.profiles(id),
  reconfirmed_at timestamptz,
  unique (document_id, revision_number)
);

create table if not exists public.document_invoice_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  source_draft_id uuid references public.document_drafts(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  issuer_tax_id_normalized text,
  issuer_name_normalized text,
  document_number_normalized text,
  document_date date,
  total_amount numeric(18,2),
  currency_code text,
  identity_strategy text not null default 'insufficient_data',
  invoice_identity_key text,
  duplicate_status text not null default 'clear',
  duplicate_of_document_id uuid references public.documents(id) on delete set null,
  duplicate_reason text,
  resolution_notes text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists idx_document_invoice_identities_org_key
  on public.document_invoice_identities (organization_id, invoice_identity_key);

create index if not exists idx_document_invoice_identities_org_status
  on public.document_invoice_identities (organization_id, duplicate_status);

create table if not exists public.normative_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  source_type text not null,
  base_url text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.normative_items (
  id uuid primary key default gen_random_uuid(),
  normative_document_id uuid not null references public.normative_documents(id) on delete cascade,
  item_code text,
  topic_codes_json jsonb not null default '[]'::jsonb,
  text text not null,
  summary text,
  legal_entity_type text,
  tax_regime_code text,
  tax_type public.tax_type,
  effective_from date,
  effective_to date,
  supersedes_item_id uuid references public.normative_items(id) on delete set null,
  embedding_status text not null default 'not_started',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_normative_items_document
  on public.normative_items (normative_document_id);

create table if not exists public.normative_update_runs (
  id uuid primary key default gen_random_uuid(),
  status public.normative_update_run_status not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  sources_checked_json jsonb not null default '[]'::jsonb,
  changes_detected_json jsonb not null default '[]'::jsonb,
  review_required boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.documents
  add column if not exists current_processing_run_id uuid references public.document_processing_runs(id) on delete set null,
  add column if not exists current_draft_id uuid references public.document_drafts(id) on delete set null,
  add column if not exists last_rule_snapshot_id uuid references public.organization_rule_snapshots(id) on delete set null,
  add column if not exists last_processed_at timestamptz;

create index if not exists idx_documents_current_processing_run
  on public.documents (current_processing_run_id);
-- <<< db/schema/08_document_ai_pipeline.sql

-- >>> db/rls/supabase_rls_policies.sql
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

create or replace function public.is_org_creator(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations as o
    where o.id = p_org_id
      and o.created_by = auth.uid()
  );
$$;

create or replace function public.organization_has_members(p_org_id uuid)
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
  );
$$;

create or replace function public.can_bootstrap_org_owner(
  p_org_id uuid,
  p_user_id uuid,
  p_role public.member_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.role() = 'authenticated'
    and p_user_id = auth.uid()
    and p_role = 'owner'::public.member_role
    and public.is_org_creator(p_org_id)
    and not public.organization_has_members(p_org_id);
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.vendors enable row level security;
alter table public.customers enable row level security;
alter table public.documents enable row level security;
alter table public.document_extractions enable row level security;
alter table public.document_relations enable row level security;
alter table public.accounting_suggestions enable row level security;
alter table public.accounting_suggestion_lines enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.normative_packages enable row level security;
alter table public.normative_documents enable row level security;
alter table public.tax_rules enable row level security;
alter table public.tax_periods enable row level security;
alter table public.vat_runs enable row level security;
alter table public.exports enable row level security;
alter table public.api_clients enable row level security;
alter table public.api_keys enable row level security;
alter table public.webhook_subscriptions enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "organizations_select_member_or_creator" on public.organizations;
create policy "organizations_select_member_or_creator"
on public.organizations
for select
using (public.is_org_member(id));

drop policy if exists "organizations_insert_authenticated_creator" on public.organizations;

drop policy if exists "organizations_update_owner_admin" on public.organizations;
create policy "organizations_update_owner_admin"
on public.organizations
for update
using (
  public.has_org_role(
    id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
)
with check (
  public.has_org_role(
    id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
);

drop policy if exists "organizations_delete_owner_admin" on public.organizations;
create policy "organizations_delete_owner_admin"
on public.organizations
for delete
using (
  public.has_org_role(
    id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
);

drop policy if exists "organization_members_select_self_or_owner_admin" on public.organization_members;
drop policy if exists "organization_members_select_member" on public.organization_members;
create policy "organization_members_select_member"
on public.organization_members
for select
using (public.is_org_member(organization_id));

drop policy if exists "organization_members_insert_owner_admin_or_bootstrap" on public.organization_members;

drop policy if exists "organization_members_update_owner_admin" on public.organization_members;
create policy "organization_members_update_owner_admin"
on public.organization_members
for update
using (
  public.has_org_role(
    organization_id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
);

drop policy if exists "organization_members_delete_owner_admin" on public.organization_members;
create policy "organization_members_delete_owner_admin"
on public.organization_members
for delete
using (
  public.has_org_role(
    organization_id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
);

drop policy if exists "chart_of_accounts_select_member" on public.chart_of_accounts;
create policy "chart_of_accounts_select_member"
on public.chart_of_accounts
for select
using (public.is_active_member(organization_id));

drop policy if exists "chart_of_accounts_insert_accounting_roles" on public.chart_of_accounts;
create policy "chart_of_accounts_insert_accounting_roles"
on public.chart_of_accounts
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

drop policy if exists "chart_of_accounts_update_accounting_roles" on public.chart_of_accounts;
create policy "chart_of_accounts_update_accounting_roles"
on public.chart_of_accounts
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

drop policy if exists "chart_of_accounts_delete_accounting_roles" on public.chart_of_accounts;
create policy "chart_of_accounts_delete_accounting_roles"
on public.chart_of_accounts
for delete
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
);

drop policy if exists "vendors_select_member" on public.vendors;
create policy "vendors_select_member"
on public.vendors
for select
using (public.is_active_member(organization_id));

drop policy if exists "vendors_insert_accounting_roles" on public.vendors;
create policy "vendors_insert_accounting_roles"
on public.vendors
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

drop policy if exists "vendors_update_accounting_roles" on public.vendors;
create policy "vendors_update_accounting_roles"
on public.vendors
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

drop policy if exists "vendors_delete_accounting_roles" on public.vendors;
create policy "vendors_delete_accounting_roles"
on public.vendors
for delete
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
);

drop policy if exists "customers_select_member" on public.customers;
create policy "customers_select_member"
on public.customers
for select
using (public.is_active_member(organization_id));

drop policy if exists "customers_insert_accounting_roles" on public.customers;
create policy "customers_insert_accounting_roles"
on public.customers
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

drop policy if exists "customers_update_accounting_roles" on public.customers;
create policy "customers_update_accounting_roles"
on public.customers
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

drop policy if exists "customers_delete_accounting_roles" on public.customers;
create policy "customers_delete_accounting_roles"
on public.customers
for delete
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
);

drop policy if exists "documents_select_member" on public.documents;
create policy "documents_select_member"
on public.documents
for select
using (public.is_active_member(organization_id));

drop policy if exists "documents_insert_document_roles" on public.documents;
create policy "documents_insert_document_roles"
on public.documents
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "documents_update_document_roles" on public.documents;
create policy "documents_update_document_roles"
on public.documents
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
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
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

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

drop policy if exists "document_extractions_select_member" on public.document_extractions;
create policy "document_extractions_select_member"
on public.document_extractions
for select
using (
  exists (
    select 1
    from public.documents as d
    where d.id = document_id
      and public.is_active_member(d.organization_id)
  )
);

drop policy if exists "document_extractions_insert_document_roles" on public.document_extractions;
create policy "document_extractions_insert_document_roles"
on public.document_extractions
for insert
with check (
  exists (
    select 1
    from public.documents as d
    where d.id = document_id
      and public.has_org_role(
        d.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
);

drop policy if exists "document_extractions_update_document_roles" on public.document_extractions;
create policy "document_extractions_update_document_roles"
on public.document_extractions
for update
using (
  exists (
    select 1
    from public.documents as d
    where d.id = document_id
      and public.has_org_role(
        d.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
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
    from public.documents as d
    where d.id = document_id
      and public.has_org_role(
        d.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
);

drop policy if exists "document_relations_select_member" on public.document_relations;
create policy "document_relations_select_member"
on public.document_relations
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_relations_insert_document_roles" on public.document_relations;
create policy "document_relations_insert_document_roles"
on public.document_relations
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_relations_update_document_roles" on public.document_relations;
create policy "document_relations_update_document_roles"
on public.document_relations
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
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
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_relations_delete_document_roles" on public.document_relations;
create policy "document_relations_delete_document_roles"
on public.document_relations
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "accounting_suggestions_select_member" on public.accounting_suggestions;
create policy "accounting_suggestions_select_member"
on public.accounting_suggestions
for select
using (public.is_active_member(organization_id));

drop policy if exists "accounting_suggestions_insert_accounting_roles" on public.accounting_suggestions;
create policy "accounting_suggestions_insert_accounting_roles"
on public.accounting_suggestions
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

drop policy if exists "accounting_suggestions_update_accounting_roles" on public.accounting_suggestions;
create policy "accounting_suggestions_update_accounting_roles"
on public.accounting_suggestions
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

drop policy if exists "accounting_suggestion_lines_select_member" on public.accounting_suggestion_lines;
create policy "accounting_suggestion_lines_select_member"
on public.accounting_suggestion_lines
for select
using (
  exists (
    select 1
    from public.accounting_suggestions as s
    where s.id = suggestion_id
      and public.is_active_member(s.organization_id)
  )
);

drop policy if exists "accounting_suggestion_lines_insert_accounting_roles" on public.accounting_suggestion_lines;
create policy "accounting_suggestion_lines_insert_accounting_roles"
on public.accounting_suggestion_lines
for insert
with check (
  exists (
    select 1
    from public.accounting_suggestions as s
    where s.id = suggestion_id
      and public.has_org_role(
        s.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "accounting_suggestion_lines_update_accounting_roles" on public.accounting_suggestion_lines;
create policy "accounting_suggestion_lines_update_accounting_roles"
on public.accounting_suggestion_lines
for update
using (
  exists (
    select 1
    from public.accounting_suggestions as s
    where s.id = suggestion_id
      and public.has_org_role(
        s.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
)
with check (
  exists (
    select 1
    from public.accounting_suggestions as s
    where s.id = suggestion_id
      and public.has_org_role(
        s.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "accounting_suggestion_lines_delete_accounting_roles" on public.accounting_suggestion_lines;
create policy "accounting_suggestion_lines_delete_accounting_roles"
on public.accounting_suggestion_lines
for delete
using (
  exists (
    select 1
    from public.accounting_suggestions as s
    where s.id = suggestion_id
      and public.has_org_role(
        s.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "journal_entries_select_member" on public.journal_entries;
create policy "journal_entries_select_member"
on public.journal_entries
for select
using (public.is_active_member(organization_id));

drop policy if exists "journal_entries_insert_accounting_roles" on public.journal_entries;
create policy "journal_entries_insert_accounting_roles"
on public.journal_entries
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

drop policy if exists "journal_entries_update_accounting_roles" on public.journal_entries;
create policy "journal_entries_update_accounting_roles"
on public.journal_entries
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

drop policy if exists "journal_entry_lines_select_member" on public.journal_entry_lines;
create policy "journal_entry_lines_select_member"
on public.journal_entry_lines
for select
using (
  exists (
    select 1
    from public.journal_entries as je
    where je.id = journal_entry_id
      and public.is_active_member(je.organization_id)
  )
);

drop policy if exists "journal_entry_lines_insert_accounting_roles" on public.journal_entry_lines;
create policy "journal_entry_lines_insert_accounting_roles"
on public.journal_entry_lines
for insert
with check (
  exists (
    select 1
    from public.journal_entries as je
    where je.id = journal_entry_id
      and public.has_org_role(
        je.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "journal_entry_lines_update_accounting_roles" on public.journal_entry_lines;
create policy "journal_entry_lines_update_accounting_roles"
on public.journal_entry_lines
for update
using (
  exists (
    select 1
    from public.journal_entries as je
    where je.id = journal_entry_id
      and public.has_org_role(
        je.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
)
with check (
  exists (
    select 1
    from public.journal_entries as je
    where je.id = journal_entry_id
      and public.has_org_role(
        je.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "journal_entry_lines_delete_accounting_roles" on public.journal_entry_lines;
create policy "journal_entry_lines_delete_accounting_roles"
on public.journal_entry_lines
for delete
using (
  exists (
    select 1
    from public.journal_entries as je
    where je.id = journal_entry_id
      and public.has_org_role(
        je.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "normative_packages_select_authenticated" on public.normative_packages;
create policy "normative_packages_select_authenticated"
on public.normative_packages
for select
using (auth.role() = 'authenticated');

drop policy if exists "normative_documents_select_authenticated" on public.normative_documents;
create policy "normative_documents_select_authenticated"
on public.normative_documents
for select
using (auth.role() = 'authenticated');

drop policy if exists "tax_rules_select_visible" on public.tax_rules;
create policy "tax_rules_select_visible"
on public.tax_rules
for select
using (
  (
    organization_id is not null
    and public.is_active_member(organization_id)
  )
  or (
    organization_id is null
    and auth.role() = 'authenticated'
  )
);

drop policy if exists "tax_rules_insert_accounting_roles" on public.tax_rules;
create policy "tax_rules_insert_accounting_roles"
on public.tax_rules
for insert
with check (
  organization_id is not null
  and public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "tax_rules_update_accounting_roles" on public.tax_rules;
create policy "tax_rules_update_accounting_roles"
on public.tax_rules
for update
using (
  organization_id is not null
  and public.has_org_role(
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
  organization_id is not null
  and public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "tax_rules_delete_accounting_roles" on public.tax_rules;
create policy "tax_rules_delete_accounting_roles"
on public.tax_rules
for delete
using (
  organization_id is not null
  and public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "tax_periods_select_member" on public.tax_periods;
create policy "tax_periods_select_member"
on public.tax_periods
for select
using (public.is_active_member(organization_id));

drop policy if exists "tax_periods_insert_accounting_roles" on public.tax_periods;
create policy "tax_periods_insert_accounting_roles"
on public.tax_periods
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

drop policy if exists "tax_periods_update_accounting_roles" on public.tax_periods;
create policy "tax_periods_update_accounting_roles"
on public.tax_periods
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

drop policy if exists "vat_runs_select_member" on public.vat_runs;
create policy "vat_runs_select_member"
on public.vat_runs
for select
using (public.is_active_member(organization_id));

drop policy if exists "vat_runs_insert_accounting_roles" on public.vat_runs;
create policy "vat_runs_insert_accounting_roles"
on public.vat_runs
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

drop policy if exists "vat_runs_update_accounting_roles" on public.vat_runs;
create policy "vat_runs_update_accounting_roles"
on public.vat_runs
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

drop policy if exists "exports_select_member" on public.exports;
create policy "exports_select_member"
on public.exports
for select
using (public.is_active_member(organization_id));

drop policy if exists "exports_insert_accounting_roles" on public.exports;
create policy "exports_insert_accounting_roles"
on public.exports
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

drop policy if exists "exports_update_accounting_roles" on public.exports;
create policy "exports_update_accounting_roles"
on public.exports
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

drop policy if exists "api_clients_select_integration_roles" on public.api_clients;
create policy "api_clients_select_integration_roles"
on public.api_clients
for select
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "api_clients_insert_integration_roles" on public.api_clients;
create policy "api_clients_insert_integration_roles"
on public.api_clients
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "api_clients_update_integration_roles" on public.api_clients;
create policy "api_clients_update_integration_roles"
on public.api_clients
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "api_clients_delete_integration_roles" on public.api_clients;
create policy "api_clients_delete_integration_roles"
on public.api_clients
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "api_keys_select_integration_roles" on public.api_keys;
create policy "api_keys_select_integration_roles"
on public.api_keys
for select
using (
  exists (
    select 1
    from public.api_clients as ac
    where ac.id = api_client_id
      and public.has_org_role(
        ac.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'developer'::public.member_role
        ]
      )
  )
);

drop policy if exists "api_keys_insert_integration_roles" on public.api_keys;
create policy "api_keys_insert_integration_roles"
on public.api_keys
for insert
with check (
  exists (
    select 1
    from public.api_clients as ac
    where ac.id = api_client_id
      and public.has_org_role(
        ac.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'developer'::public.member_role
        ]
      )
  )
);

drop policy if exists "api_keys_update_integration_roles" on public.api_keys;
create policy "api_keys_update_integration_roles"
on public.api_keys
for update
using (
  exists (
    select 1
    from public.api_clients as ac
    where ac.id = api_client_id
      and public.has_org_role(
        ac.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'developer'::public.member_role
        ]
      )
  )
)
with check (
  exists (
    select 1
    from public.api_clients as ac
    where ac.id = api_client_id
      and public.has_org_role(
        ac.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'developer'::public.member_role
        ]
      )
  )
);

drop policy if exists "api_keys_delete_integration_roles" on public.api_keys;
create policy "api_keys_delete_integration_roles"
on public.api_keys
for delete
using (
  exists (
    select 1
    from public.api_clients as ac
    where ac.id = api_client_id
      and public.has_org_role(
        ac.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'developer'::public.member_role
        ]
      )
  )
);

drop policy if exists "webhook_subscriptions_select_integration_roles" on public.webhook_subscriptions;
create policy "webhook_subscriptions_select_integration_roles"
on public.webhook_subscriptions
for select
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "webhook_subscriptions_insert_integration_roles" on public.webhook_subscriptions;
create policy "webhook_subscriptions_insert_integration_roles"
on public.webhook_subscriptions
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "webhook_subscriptions_update_integration_roles" on public.webhook_subscriptions;
create policy "webhook_subscriptions_update_integration_roles"
on public.webhook_subscriptions
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "webhook_subscriptions_delete_integration_roles" on public.webhook_subscriptions;
create policy "webhook_subscriptions_delete_integration_roles"
on public.webhook_subscriptions
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "audit_log_select_member" on public.audit_log;
create policy "audit_log_select_member"
on public.audit_log
for select
using (
  organization_id is not null
  and public.is_active_member(organization_id)
);

alter table public.organization_profile_versions enable row level security;
alter table public.organization_rule_snapshots enable row level security;
alter table public.document_processing_runs enable row level security;
alter table public.document_field_candidates enable row level security;
alter table public.document_classification_candidates enable row level security;
alter table public.document_drafts enable row level security;
alter table public.document_draft_steps enable row level security;
alter table public.document_draft_autosaves enable row level security;
alter table public.document_confirmations enable row level security;
alter table public.document_revisions enable row level security;
alter table public.document_invoice_identities enable row level security;
alter table public.normative_sources enable row level security;
alter table public.normative_items enable row level security;
alter table public.normative_update_runs enable row level security;

drop policy if exists "organization_profile_versions_select_member" on public.organization_profile_versions;
create policy "organization_profile_versions_select_member"
on public.organization_profile_versions
for select
using (public.is_active_member(organization_id));

drop policy if exists "organization_profile_versions_insert_profile_roles" on public.organization_profile_versions;
create policy "organization_profile_versions_insert_profile_roles"
on public.organization_profile_versions
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

drop policy if exists "organization_profile_versions_update_profile_roles" on public.organization_profile_versions;
create policy "organization_profile_versions_update_profile_roles"
on public.organization_profile_versions
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

drop policy if exists "organization_rule_snapshots_select_member" on public.organization_rule_snapshots;
create policy "organization_rule_snapshots_select_member"
on public.organization_rule_snapshots
for select
using (public.is_active_member(organization_id));

drop policy if exists "organization_rule_snapshots_insert_profile_roles" on public.organization_rule_snapshots;
create policy "organization_rule_snapshots_insert_profile_roles"
on public.organization_rule_snapshots
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

drop policy if exists "organization_rule_snapshots_update_profile_roles" on public.organization_rule_snapshots;
create policy "organization_rule_snapshots_update_profile_roles"
on public.organization_rule_snapshots
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

drop policy if exists "document_processing_runs_select_member" on public.document_processing_runs;
create policy "document_processing_runs_select_member"
on public.document_processing_runs
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_processing_runs_insert_document_roles" on public.document_processing_runs;
create policy "document_processing_runs_insert_document_roles"
on public.document_processing_runs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_processing_runs_update_document_roles" on public.document_processing_runs;
create policy "document_processing_runs_update_document_roles"
on public.document_processing_runs
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
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
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_field_candidates_select_member" on public.document_field_candidates;
create policy "document_field_candidates_select_member"
on public.document_field_candidates
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_field_candidates_insert_document_roles" on public.document_field_candidates;
create policy "document_field_candidates_insert_document_roles"
on public.document_field_candidates
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_classification_candidates_select_member" on public.document_classification_candidates;
create policy "document_classification_candidates_select_member"
on public.document_classification_candidates
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_classification_candidates_insert_document_roles" on public.document_classification_candidates;
create policy "document_classification_candidates_insert_document_roles"
on public.document_classification_candidates
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_drafts_select_member" on public.document_drafts;
create policy "document_drafts_select_member"
on public.document_drafts
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_drafts_insert_document_roles" on public.document_drafts;
create policy "document_drafts_insert_document_roles"
on public.document_drafts
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_drafts_update_document_roles" on public.document_drafts;
create policy "document_drafts_update_document_roles"
on public.document_drafts
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
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
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_draft_steps_select_member" on public.document_draft_steps;
create policy "document_draft_steps_select_member"
on public.document_draft_steps
for select
using (
  exists (
    select 1
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.is_active_member(dd.organization_id)
  )
);

drop policy if exists "document_draft_steps_insert_document_roles" on public.document_draft_steps;
create policy "document_draft_steps_insert_document_roles"
on public.document_draft_steps
for insert
with check (
  exists (
    select 1
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.has_org_role(
        dd.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
);

drop policy if exists "document_draft_steps_update_document_roles" on public.document_draft_steps;
create policy "document_draft_steps_update_document_roles"
on public.document_draft_steps
for update
using (
  exists (
    select 1
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.has_org_role(
        dd.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
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
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.has_org_role(
        dd.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
);

drop policy if exists "document_draft_autosaves_select_member" on public.document_draft_autosaves;
create policy "document_draft_autosaves_select_member"
on public.document_draft_autosaves
for select
using (
  exists (
    select 1
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.is_active_member(dd.organization_id)
  )
);

drop policy if exists "document_draft_autosaves_insert_document_roles" on public.document_draft_autosaves;
create policy "document_draft_autosaves_insert_document_roles"
on public.document_draft_autosaves
for insert
with check (
  exists (
    select 1
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.has_org_role(
        dd.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
);

drop policy if exists "document_confirmations_select_member" on public.document_confirmations;
create policy "document_confirmations_select_member"
on public.document_confirmations
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_confirmations_insert_confirmation_roles" on public.document_confirmations;
create policy "document_confirmations_insert_confirmation_roles"
on public.document_confirmations
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

drop policy if exists "document_revisions_select_member" on public.document_revisions;
create policy "document_revisions_select_member"
on public.document_revisions
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_revisions_insert_document_roles" on public.document_revisions;
create policy "document_revisions_insert_document_roles"
on public.document_revisions
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_revisions_update_document_roles" on public.document_revisions;
create policy "document_revisions_update_document_roles"
on public.document_revisions
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
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
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_invoice_identities_select_member" on public.document_invoice_identities;
create policy "document_invoice_identities_select_member"
on public.document_invoice_identities
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_invoice_identities_insert_document_roles" on public.document_invoice_identities;
create policy "document_invoice_identities_insert_document_roles"
on public.document_invoice_identities
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_invoice_identities_update_document_roles" on public.document_invoice_identities;
create policy "document_invoice_identities_update_document_roles"
on public.document_invoice_identities
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
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
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "normative_sources_select_authenticated" on public.normative_sources;
create policy "normative_sources_select_authenticated"
on public.normative_sources
for select
using (auth.role() = 'authenticated');

drop policy if exists "normative_items_select_authenticated" on public.normative_items;
create policy "normative_items_select_authenticated"
on public.normative_items
for select
using (auth.role() = 'authenticated');

drop policy if exists "normative_update_runs_select_authenticated" on public.normative_update_runs;
create policy "normative_update_runs_select_authenticated"
on public.normative_update_runs
for select
using (auth.role() = 'authenticated');
-- <<< db/rls/supabase_rls_policies.sql
