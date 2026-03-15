alter table public.organization_profile_versions
  add column if not exists fiscal_address_text text,
  add column if not exists fiscal_department text,
  add column if not exists fiscal_city text,
  add column if not exists fiscal_postal_code text,
  add column if not exists fiscal_lat numeric(10,6),
  add column if not exists fiscal_long numeric(10,6),
  add column if not exists location_risk_policy text not null default 'warn_and_require_note',
  add column if not exists travel_radius_km_policy numeric(10,2);

update public.organization_profile_versions
set
  fiscal_address_text = coalesce(fiscal_address_text, nullif(profile_json ->> 'fiscal_address_text', '')),
  fiscal_department = coalesce(fiscal_department, nullif(profile_json ->> 'fiscal_department', '')),
  fiscal_city = coalesce(fiscal_city, nullif(profile_json ->> 'fiscal_city', '')),
  fiscal_postal_code = coalesce(fiscal_postal_code, nullif(profile_json ->> 'fiscal_postal_code', '')),
  location_risk_policy = coalesce(location_risk_policy, nullif(profile_json ->> 'location_risk_policy', ''), 'warn_and_require_note')
where profile_json <> '{}'::jsonb;

alter table public.vendors
  add column if not exists fiscal_address_text text,
  add column if not exists fiscal_department text,
  add column if not exists fiscal_city text,
  add column if not exists fiscal_lat numeric(10,6),
  add column if not exists fiscal_long numeric(10,6),
  add column if not exists issuer_branch_code text,
  add column if not exists merchant_category_hint text,
  add column if not exists location_confidence numeric(10,6);

alter table public.documents
  add column if not exists issuer_address_raw text,
  add column if not exists issuer_department text,
  add column if not exists issuer_city text,
  add column if not exists issuer_branch_code text,
  add column if not exists location_extraction_confidence numeric(10,6),
  add column if not exists location_signal_code text,
  add column if not exists location_signal_severity text,
  add column if not exists location_signal_payload jsonb not null default '{}'::jsonb,
  add column if not exists requires_business_purpose_review boolean not null default false,
  add column if not exists business_purpose_note text,
  add column if not exists suggested_expense_family text,
  add column if not exists suggested_tax_profile_code text;

create index if not exists idx_documents_org_location_signal
  on public.documents (organization_id, location_signal_severity, location_signal_code, created_at desc);

create table if not exists public.uy_locations (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  city text not null,
  postal_code text,
  lat numeric(10,6) not null,
  long numeric(10,6) not null,
  source text not null default 'seed_v1',
  source_version text not null default '2026-03-step5-location-v1',
  created_at timestamptz not null default now(),
  unique (department, city)
);

insert into public.uy_locations (department, city, postal_code, lat, long, source, source_version)
values
  ('montevideo', 'montevideo', '11000', -34.901100, -56.164500, 'seed_v1', '2026-03-step5-location-v1'),
  ('canelones', 'canelones', '90000', -34.522800, -56.277800, 'seed_v1', '2026-03-step5-location-v1'),
  ('canelones', 'las piedras', '90200', -34.730200, -56.219200, 'seed_v1', '2026-03-step5-location-v1'),
  ('canelones', 'ciudad de la costa', '15000', -34.816700, -55.950000, 'seed_v1', '2026-03-step5-location-v1'),
  ('maldonado', 'maldonado', '20000', -34.900000, -54.950000, 'seed_v1', '2026-03-step5-location-v1'),
  ('maldonado', 'punta del este', '20100', -34.962700, -54.945100, 'seed_v1', '2026-03-step5-location-v1'),
  ('colonia', 'colonia del sacramento', '70000', -34.471100, -57.844200, 'seed_v1', '2026-03-step5-location-v1'),
  ('salto', 'salto', '50000', -31.383300, -57.966700, 'seed_v1', '2026-03-step5-location-v1'),
  ('paysandu', 'paysandu', '60000', -32.321400, -58.075600, 'seed_v1', '2026-03-step5-location-v1'),
  ('rivera', 'rivera', '40000', -30.905300, -55.550800, 'seed_v1', '2026-03-step5-location-v1'),
  ('rocha', 'rocha', '27000', -34.483300, -54.333300, 'seed_v1', '2026-03-step5-location-v1'),
  ('lavalleja', 'minas', '30000', -34.375900, -55.237700, 'seed_v1', '2026-03-step5-location-v1'),
  ('soriano', 'mercedes', '75000', -33.252400, -58.030500, 'seed_v1', '2026-03-step5-location-v1'),
  ('san jose', 'san jose de mayo', '80000', -34.337500, -56.713600, 'seed_v1', '2026-03-step5-location-v1'),
  ('florida', 'florida', '94000', -34.095600, -56.214200, 'seed_v1', '2026-03-step5-location-v1'),
  ('flores', 'trinidad', '85000', -33.516500, -56.899600, 'seed_v1', '2026-03-step5-location-v1'),
  ('tacuarembo', 'tacuarembo', '45000', -31.716900, -55.981100, 'seed_v1', '2026-03-step5-location-v1'),
  ('durazno', 'durazno', '97000', -33.380600, -56.523600, 'seed_v1', '2026-03-step5-location-v1'),
  ('treinta y tres', 'treinta y tres', '33000', -33.233300, -54.383300, 'seed_v1', '2026-03-step5-location-v1'),
  ('rio negro', 'fray bentos', '65000', -33.116500, -58.310700, 'seed_v1', '2026-03-step5-location-v1'),
  ('cerro largo', 'melo', '37000', -32.370300, -54.167500, 'seed_v1', '2026-03-step5-location-v1'),
  ('artigas', 'artigas', '55000', -30.400000, -56.466700, 'seed_v1', '2026-03-step5-location-v1')
on conflict (department, city) do nothing;
