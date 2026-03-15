create table if not exists public.organization_preset_ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  business_profile_version_id uuid references public.organization_business_profile_versions(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  request_origin text not null,
  ip_hash text,
  input_hash text not null,
  input_snapshot_json jsonb not null default '{}'::jsonb,
  rule_recommendation_json jsonb not null default '{}'::jsonb,
  candidate_compositions_json jsonb not null default '[]'::jsonb,
  selected_composition_code text,
  confidence numeric(6,5),
  target_audience_fit text,
  key_benefit text,
  setup_tip text,
  assistant_letter_markdown text,
  observations_json jsonb not null default '[]'::jsonb,
  suggested_cost_centers_json jsonb not null default '[]'::jsonb,
  cost_center_draft_saved boolean not null default false,
  cost_center_draft_saved_at timestamp with time zone,
  cost_center_draft_saved_by uuid references public.profiles(id) on delete set null,
  provider_code text,
  model_code text,
  response_id text,
  prompt_hash text,
  request_payload_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(12,6),
  status text not null default 'completed',
  failure_message text,
  created_at timestamp with time zone not null default now()
);

create index if not exists organization_preset_ai_runs_requested_by_created_idx
  on public.organization_preset_ai_runs (requested_by, created_at desc);

create index if not exists organization_preset_ai_runs_ip_hash_created_idx
  on public.organization_preset_ai_runs (ip_hash, created_at desc);

create index if not exists organization_preset_ai_runs_organization_created_idx
  on public.organization_preset_ai_runs (organization_id, created_at desc);

alter table if exists public.organization_preset_applications
  add column if not exists ai_run_id uuid references public.organization_preset_ai_runs(id) on delete set null;

create index if not exists organization_preset_applications_ai_run_idx
  on public.organization_preset_applications (ai_run_id);
