create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  direction public.document_direction not null default 'purchase',
  document_type text,
  status public.document_status not null default 'uploaded',
  storage_bucket text not null default 'documents-private',
  storage_path text not null,
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
