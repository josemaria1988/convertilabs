alter table if exists public.organization_business_profile_versions
  add column if not exists catalog_version text;

alter table if exists public.organization_business_profile_versions
  alter column catalog_version set default 'uy-ciiu-rev4-dgi-ine-v1-2026-03-15';

update public.organization_business_profile_versions
set catalog_version = 'uy-ciiu-rev4-dgi-ine-v1-2026-03-15'
where catalog_version is null;

alter table if exists public.organization_business_profile_versions
  alter column catalog_version set not null;
