-- Zeta chart of accounts mirror support.
-- Adds provider mirror fields used to materialize RESTPlanCuentasV2Query
-- into public.chart_of_accounts without touching local manual accounts.

alter table public.chart_of_accounts
  add column if not exists external_parent_code text,
  add column if not exists account_level integer,
  add column if not exists is_imputable boolean,
  add column if not exists uses_cost_centers boolean,
  add column if not exists literal_tributario integer,
  add column if not exists last_synced_from_provider_at timestamptz;

do $$
begin
  if exists (
    select 1
    from public.chart_of_accounts
    where source_provider is not null
      and external_code is not null
    group by organization_id, source_provider, external_code
    having count(*) > 1
  ) then
    raise exception 'Cannot add chart_of_accounts Zeta mirror unique constraint: duplicate provider external codes exist.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'chart_of_accounts_org_provider_external_code_key'
      and conrelid = 'public.chart_of_accounts'::regclass
  ) then
    alter table public.chart_of_accounts
      add constraint chart_of_accounts_org_provider_external_code_key
      unique (organization_id, source_provider, external_code);
  end if;
end
$$;

create index if not exists idx_chart_of_accounts_org_provider_imputable
  on public.chart_of_accounts (
    organization_id,
    source_provider,
    is_imputable,
    external_code
  )
  where source_provider is not null;
