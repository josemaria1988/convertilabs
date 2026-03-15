create table if not exists public.organization_business_profile_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_no integer not null,
  primary_activity_code text,
  short_description text,
  has_mixed_vat_operations boolean not null default false,
  has_imports boolean not null default false,
  has_exports boolean not null default false,
  is_multi_currency boolean not null default false,
  source text not null default 'onboarding',
  is_current boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone not null default now()
);

create unique index if not exists organization_business_profile_versions_org_version_idx
  on public.organization_business_profile_versions (organization_id, version_no);

create index if not exists organization_business_profile_versions_current_idx
  on public.organization_business_profile_versions (organization_id, is_current);

create table if not exists public.organization_business_profile_activities (
  id uuid primary key default gen_random_uuid(),
  business_profile_version_id uuid not null references public.organization_business_profile_versions(id) on delete cascade,
  activity_code text not null,
  role text not null,
  rank integer not null default 0
);

create index if not exists organization_business_profile_activities_version_idx
  on public.organization_business_profile_activities (business_profile_version_id, role, rank);

create table if not exists public.organization_business_profile_traits (
  id uuid primary key default gen_random_uuid(),
  business_profile_version_id uuid not null references public.organization_business_profile_versions(id) on delete cascade,
  trait_code text not null,
  enabled boolean not null default true
);

create index if not exists organization_business_profile_traits_version_idx
  on public.organization_business_profile_traits (business_profile_version_id, trait_code);

create table if not exists public.organization_preset_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_profile_version_id uuid references public.organization_business_profile_versions(id) on delete set null,
  base_preset_code text not null,
  overlay_codes_json jsonb not null default '[]'::jsonb,
  application_mode text not null default 'recommended',
  explanation_json jsonb not null default '{}'::jsonb,
  applied_at timestamp with time zone not null default now(),
  applied_by uuid references public.profiles(id),
  active boolean not null default true
);

create index if not exists organization_preset_applications_org_active_idx
  on public.organization_preset_applications (organization_id, active, applied_at desc);
