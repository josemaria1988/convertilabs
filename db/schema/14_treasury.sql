create table if not exists public.treasury_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  party_id uuid references public.parties(id) on delete set null,
  bank_name text not null,
  name text not null,
  account_number text,
  currency_code text not null references public.currencies(code),
  account_type text not null default 'checking',
  current_balance numeric(18,2) not null default 0,
  balance_date date,
  status text not null default 'active',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_bank_accounts_type_check check (account_type in ('checking', 'savings', 'credit_line', 'other')),
  constraint treasury_bank_accounts_status_check check (status in ('active', 'archived')),
  constraint treasury_bank_accounts_balance_check check (current_balance >= -9999999999999999.99)
);

create index if not exists idx_treasury_bank_accounts_org_status
  on public.treasury_bank_accounts (organization_id, status, currency_code, bank_name);

create index if not exists idx_treasury_bank_accounts_org_party
  on public.treasury_bank_accounts (organization_id, party_id)
  where party_id is not null;

create table if not exists public.treasury_bank_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bank_account_id uuid not null references public.treasury_bank_accounts(id) on delete cascade,
  balance numeric(18,2) not null,
  currency_code text not null references public.currencies(code),
  snapshot_date date not null,
  source text not null default 'manual',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_bank_balance_snapshots_source_check check (source in ('web_banco', 'email_ejecutiva', 'manual', 'otro'))
);

create index if not exists idx_treasury_balance_snapshots_org_account_date
  on public.treasury_bank_balance_snapshots (organization_id, bank_account_id, snapshot_date desc, created_at desc);

create table if not exists public.treasury_vales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bank_account_id uuid references public.treasury_bank_accounts(id) on delete set null,
  bank_name text not null,
  operation_number text,
  internal_reference text,
  currency_code text not null references public.currencies(code),
  original_principal numeric(18,2) not null,
  current_principal numeric(18,2) not null,
  status text not null default 'active',
  source text not null default 'manual',
  source_text text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_vales_status_check check (status in ('draft', 'active', 'closed', 'cancelled')),
  constraint treasury_vales_source_check check (source in ('web_banco', 'email_ejecutiva', 'manual', 'otro')),
  constraint treasury_vales_original_principal_check check (original_principal >= 0),
  constraint treasury_vales_current_principal_check check (current_principal >= 0)
);

create index if not exists idx_treasury_vales_org_status_due
  on public.treasury_vales (organization_id, status, currency_code, updated_at desc);

create index if not exists idx_treasury_vales_org_bank_account
  on public.treasury_vales (organization_id, bank_account_id)
  where bank_account_id is not null;

create table if not exists public.treasury_vale_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vale_id uuid not null references public.treasury_vales(id) on delete cascade,
  sequence integer not null,
  principal_amount numeric(18,2) not null,
  expected_interest_amount numeric(18,2) not null default 0,
  expected_fees_amount numeric(18,2) not null default 0,
  expected_partial_principal_payment numeric(18,2) not null default 0,
  issue_date date,
  due_date date not null,
  planned_action text not null default 'undecided',
  renewal_offered boolean not null default false,
  renewal_confirmed boolean not null default false,
  expected_new_due_date date,
  expected_new_principal_amount numeric(18,2),
  status text not null default 'pending',
  source text not null default 'manual',
  source_text text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, vale_id, sequence),
  constraint treasury_vale_terms_status_check check (status in ('pending', 'renewed', 'closed', 'cancelled')),
  constraint treasury_vale_terms_planned_action_check check (planned_action in ('undecided', 'renew', 'close')),
  constraint treasury_vale_terms_source_check check (source in ('web_banco', 'email_ejecutiva', 'manual', 'otro')),
  constraint treasury_vale_terms_principal_check check (principal_amount >= 0),
  constraint treasury_vale_terms_interest_check check (expected_interest_amount >= 0),
  constraint treasury_vale_terms_fees_check check (expected_fees_amount >= 0),
  constraint treasury_vale_terms_partial_principal_check check (expected_partial_principal_payment >= 0),
  constraint treasury_vale_terms_new_principal_check check (expected_new_principal_amount is null or expected_new_principal_amount >= 0)
);

create index if not exists idx_treasury_vale_terms_org_due
  on public.treasury_vale_terms (organization_id, status, due_date, planned_action, renewal_confirmed);

create index if not exists idx_treasury_vale_terms_org_vale
  on public.treasury_vale_terms (organization_id, vale_id, sequence desc);

create table if not exists public.treasury_vale_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vale_id uuid not null references public.treasury_vales(id) on delete cascade,
  vale_term_id uuid references public.treasury_vale_terms(id) on delete set null,
  event_type text not null,
  event_date date not null,
  principal_paid_amount numeric(18,2) not null default 0,
  interest_paid_amount numeric(18,2) not null default 0,
  fees_paid_amount numeric(18,2) not null default 0,
  resulting_principal numeric(18,2),
  new_due_date date,
  source text not null default 'manual',
  source_text text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_vale_events_type_check check (event_type in ('created', 'updated', 'renewal_confirmed', 'renewed', 'closed', 'note', 'cancelled')),
  constraint treasury_vale_events_source_check check (source in ('web_banco', 'email_ejecutiva', 'manual', 'otro')),
  constraint treasury_vale_events_principal_paid_check check (principal_paid_amount >= 0),
  constraint treasury_vale_events_interest_paid_check check (interest_paid_amount >= 0),
  constraint treasury_vale_events_fees_paid_check check (fees_paid_amount >= 0),
  constraint treasury_vale_events_resulting_principal_check check (resulting_principal is null or resulting_principal >= 0)
);

create index if not exists idx_treasury_vale_events_org_vale_created
  on public.treasury_vale_events (organization_id, vale_id, event_date desc, created_at desc);

create table if not exists public.treasury_manual_receivables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  party_id uuid references public.parties(id) on delete set null,
  customer_name text not null,
  document_number text,
  description text,
  currency_code text not null references public.currencies(code),
  amount numeric(18,2) not null,
  issue_date date,
  expected_date date not null,
  collected_at date,
  status text not null default 'pending',
  confidence text not null default 'probable',
  source text not null default 'manual',
  source_text text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_manual_receivables_status_check check (status in ('pending', 'collected', 'overdue', 'cancelled')),
  constraint treasury_manual_receivables_confidence_check check (confidence in ('confirmed', 'probable', 'doubtful')),
  constraint treasury_manual_receivables_source_check check (source in ('web_banco', 'email_ejecutiva', 'manual', 'otro')),
  constraint treasury_manual_receivables_amount_check check (amount >= 0)
);

create index if not exists idx_treasury_manual_receivables_org_expected
  on public.treasury_manual_receivables (organization_id, status, expected_date, confidence);

create index if not exists idx_treasury_manual_receivables_org_party
  on public.treasury_manual_receivables (organization_id, party_id)
  where party_id is not null;

create table if not exists public.treasury_reserve_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  currency_code text not null references public.currencies(code),
  min_buffer_amount numeric(18,2) not null default 0,
  horizon_days integer not null default 45,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_reserve_rules_buffer_check check (min_buffer_amount >= 0),
  constraint treasury_reserve_rules_horizon_check check (horizon_days > 0 and horizon_days <= 365)
);

create unique index if not exists idx_treasury_reserve_rules_one_active
  on public.treasury_reserve_rules (organization_id, currency_code)
  where active = true;

create or replace function public.treasury_record_vale_renewal(
  p_organization_id uuid,
  p_vale_id uuid,
  p_vale_term_id uuid,
  p_event_date date,
  p_interest_paid_amount numeric,
  p_fees_paid_amount numeric,
  p_principal_paid_amount numeric,
  p_new_principal_amount numeric,
  p_new_due_date date,
  p_source text default 'manual',
  p_source_text text default null,
  p_notes text default null,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_term public.treasury_vale_terms%rowtype;
  v_vale public.treasury_vales%rowtype;
  v_new_principal numeric(18,2);
  v_new_term_id uuid;
begin
  if auth.role() = 'authenticated'
    and not public.has_org_role(
      p_organization_id,
      array['owner'::public.member_role, 'admin'::public.member_role, 'admin_processing'::public.member_role, 'accountant'::public.member_role, 'operator'::public.member_role]
    ) then
    raise exception 'No autorizado para renovar vales.';
  end if;

  if p_new_due_date is null then
    raise exception 'Nuevo vencimiento obligatorio.';
  end if;

  if coalesce(p_interest_paid_amount, 0) < 0
    or coalesce(p_fees_paid_amount, 0) < 0
    or coalesce(p_principal_paid_amount, 0) < 0
    or coalesce(p_new_principal_amount, 0) < 0 then
    raise exception 'Los importes no pueden ser negativos.';
  end if;

  select *
  into v_term
  from public.treasury_vale_terms
  where organization_id = p_organization_id
    and vale_id = p_vale_id
    and id = p_vale_term_id
  for update;

  if v_term.id is null then
    raise exception 'Periodo de vale no encontrado.';
  end if;

  if v_term.status <> 'pending' then
    raise exception 'No se puede renovar un periodo ya resuelto.';
  end if;

  select *
  into v_vale
  from public.treasury_vales
  where organization_id = p_organization_id
    and id = p_vale_id
  for update;

  if v_vale.id is null then
    raise exception 'Vale no encontrado.';
  end if;

  v_new_principal := coalesce(
    p_new_principal_amount,
    greatest(v_term.principal_amount - coalesce(p_principal_paid_amount, 0), 0)
  );

  insert into public.treasury_vale_events (
    organization_id,
    vale_id,
    vale_term_id,
    event_type,
    event_date,
    principal_paid_amount,
    interest_paid_amount,
    fees_paid_amount,
    resulting_principal,
    new_due_date,
    source,
    source_text,
    notes,
    created_by
  )
  values (
    p_organization_id,
    p_vale_id,
    p_vale_term_id,
    'renewed',
    p_event_date,
    coalesce(p_principal_paid_amount, 0),
    coalesce(p_interest_paid_amount, 0),
    coalesce(p_fees_paid_amount, 0),
    v_new_principal,
    p_new_due_date,
    coalesce(nullif(p_source, ''), 'manual'),
    p_source_text,
    p_notes,
    p_actor_id
  );

  update public.treasury_vale_terms
  set
    status = 'renewed',
    updated_at = now()
  where id = p_vale_term_id;

  insert into public.treasury_vale_terms (
    organization_id,
    vale_id,
    sequence,
    principal_amount,
    due_date,
    status,
    source,
    source_text,
    notes,
    created_by
  )
  values (
    p_organization_id,
    p_vale_id,
    v_term.sequence + 1,
    v_new_principal,
    p_new_due_date,
    'pending',
    coalesce(nullif(p_source, ''), 'manual'),
    p_source_text,
    p_notes,
    p_actor_id
  )
  returning id into v_new_term_id;

  update public.treasury_vales
  set
    current_principal = v_new_principal,
    status = case when v_new_principal = 0 then 'closed' else 'active' end,
    updated_at = now()
  where id = p_vale_id;

  return v_new_term_id;
end;
$$;

create or replace function public.treasury_record_vale_closure(
  p_organization_id uuid,
  p_vale_id uuid,
  p_vale_term_id uuid,
  p_event_date date,
  p_principal_paid_amount numeric,
  p_interest_paid_amount numeric,
  p_fees_paid_amount numeric,
  p_source text default 'manual',
  p_source_text text default null,
  p_notes text default null,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_term public.treasury_vale_terms%rowtype;
  v_event_id uuid;
begin
  if auth.role() = 'authenticated'
    and not public.has_org_role(
      p_organization_id,
      array['owner'::public.member_role, 'admin'::public.member_role, 'admin_processing'::public.member_role, 'accountant'::public.member_role, 'operator'::public.member_role]
    ) then
    raise exception 'No autorizado para cerrar vales.';
  end if;

  if coalesce(p_principal_paid_amount, 0) <= 0 then
    raise exception 'Capital devuelto obligatorio.';
  end if;

  if coalesce(p_principal_paid_amount, 0) < 0
    or coalesce(p_interest_paid_amount, 0) < 0
    or coalesce(p_fees_paid_amount, 0) < 0 then
    raise exception 'Los importes no pueden ser negativos.';
  end if;

  select *
  into v_term
  from public.treasury_vale_terms
  where organization_id = p_organization_id
    and vale_id = p_vale_id
    and id = p_vale_term_id
  for update;

  if v_term.id is null then
    raise exception 'Periodo de vale no encontrado.';
  end if;

  if v_term.status <> 'pending' then
    raise exception 'No se puede cerrar un periodo ya resuelto.';
  end if;

  if p_principal_paid_amount < v_term.principal_amount then
    raise exception 'El cierre total debe devolver todo el capital pendiente.';
  end if;

  insert into public.treasury_vale_events (
    organization_id,
    vale_id,
    vale_term_id,
    event_type,
    event_date,
    principal_paid_amount,
    interest_paid_amount,
    fees_paid_amount,
    resulting_principal,
    source,
    source_text,
    notes,
    created_by
  )
  values (
    p_organization_id,
    p_vale_id,
    p_vale_term_id,
    'closed',
    p_event_date,
    p_principal_paid_amount,
    coalesce(p_interest_paid_amount, 0),
    coalesce(p_fees_paid_amount, 0),
    0,
    coalesce(nullif(p_source, ''), 'manual'),
    p_source_text,
    p_notes,
    p_actor_id
  )
  returning id into v_event_id;

  update public.treasury_vale_terms
  set
    status = 'closed',
    updated_at = now()
  where id = p_vale_term_id;

  update public.treasury_vales
  set
    current_principal = 0,
    status = 'closed',
    updated_at = now()
  where id = p_vale_id;

  return v_event_id;
end;
$$;
