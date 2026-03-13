alter table public.document_processing_runs
  add column if not exists provider_response_id text,
  add column if not exists provider_status text,
  add column if not exists transport_mode text,
  add column if not exists store_remote boolean not null default false,
  add column if not exists prompt_version text,
  add column if not exists schema_version text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_polled_at timestamptz;
