-- Device subscriptions and an at-most-once delivery ledger. Endpoint/key material
-- is private; no public endpoint, task text or payload is recorded in the ledger.
create or replace function public.is_allowed_web_push_endpoint(p_endpoint text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(length(p_endpoint) <= 4096 and p_endpoint ~
    '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)(:443)?/[^[:space:]#]+$', false);
$$;

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null,
  endpoint text not null check (public.is_allowed_web_push_endpoint(endpoint)),
  endpoint_hash text not null check (endpoint_hash ~ '^[a-f0-9]{64}$'),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth_key text not null check (auth_key ~ '^[A-Za-z0-9_-]{22}$'),
  vapid_public_key text not null check (vapid_public_key ~ '^[A-Za-z0-9_-]{87}$'),
  expires_at timestamptz,
  enabled boolean not null default true,
  disabled_reason text,
  last_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, device_id)
);
create or replace function public.set_web_push_endpoint_hash()
returns trigger language plpgsql set search_path = public as $$
begin
  new.endpoint_hash := encode(sha256(convert_to(new.endpoint, 'UTF8')), 'hex');
  return new;
end; $$;
drop trigger if exists web_push_endpoint_hash on public.web_push_subscriptions;
create trigger web_push_endpoint_hash before insert or update on public.web_push_subscriptions
  for each row execute function public.set_web_push_endpoint_hash();
create unique index if not exists idx_web_push_active_endpoint
  on public.web_push_subscriptions(organization_id, endpoint_hash) where enabled;
create index if not exists idx_web_push_enabled_org
  on public.web_push_subscriptions(organization_id, user_id) where enabled;

create table if not exists public.web_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null,
  subscription_id uuid references public.web_push_subscriptions(id) on delete set null,
  endpoint_hash text not null,
  event_key text not null check (event_key ~ '^[a-f0-9]{64}$'),
  source_type text not null check (source_type in ('task', 'obligation', 'test')),
  source_id uuid,
  source_due_date date not null,
  reminder_date date not null,
  status text not null default 'claimed' check (status in ('claimed', 'accepted', 'failed', 'expired', 'unknown')),
  provider_status integer check (provider_status between 100 and 599),
  result_code text check (length(result_code) <= 60),
  claimed_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (organization_id, user_id, device_id, event_key)
);
create index if not exists idx_web_push_deliveries_org_date
  on public.web_push_deliveries(organization_id, reminder_date, status);

create or replace function public.register_web_push_subscription(
  p_organization_id uuid, p_device_id uuid, p_endpoint text, p_p256dh text,
  p_auth_key text, p_vapid_public_key text, p_expires_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null or not exists(select 1 from public.organization_members
    where organization_id=p_organization_id and user_id=v_user and is_active) then
    raise exception 'push_membership_required' using errcode='42501';
  end if;
  if p_device_id is null or not public.is_allowed_web_push_endpoint(p_endpoint)
    or (p_expires_at is not null and p_expires_at <= now()) then
    raise exception 'push_invalid_subscription' using errcode='22023';
  end if;
  -- A short global registration lock prevents concurrent endpoint/device claims.
  -- No network call is made while holding it. Reusing a browser for another
  -- account disables its previous account subscription, including other tenants.
  perform pg_advisory_xact_lock(192807401, 1);
  update public.web_push_subscriptions set enabled=false, disabled_reason='device_reassigned', updated_at=now()
  where enabled and ((user_id<>v_user and (device_id=p_device_id or endpoint=p_endpoint))
    or (organization_id=p_organization_id and endpoint=p_endpoint and device_id<>p_device_id));
  if (select count(*) from public.web_push_subscriptions where organization_id=p_organization_id
    and user_id=v_user and enabled and device_id<>p_device_id) >= 10 then
    raise exception 'push_device_limit' using errcode='22023';
  end if;
  insert into public.web_push_subscriptions(organization_id,user_id,device_id,endpoint,p256dh,auth_key,vapid_public_key,expires_at)
  values(p_organization_id,v_user,p_device_id,p_endpoint,p_p256dh,p_auth_key,p_vapid_public_key,p_expires_at)
  on conflict (organization_id,user_id,device_id) do update set
    endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth_key=excluded.auth_key,
    vapid_public_key=excluded.vapid_public_key,expires_at=excluded.expires_at,
    enabled=true,disabled_reason=null,updated_at=now()
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.disable_web_push_subscription(p_organization_id uuid,p_device_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists(select 1 from public.organization_members
    where organization_id=p_organization_id and user_id=auth.uid() and is_active) then
    raise exception 'push_membership_required' using errcode='42501';
  end if;
  update public.web_push_subscriptions set enabled=false,disabled_reason='user_disabled',updated_at=now()
    where organization_id=p_organization_id and user_id=auth.uid() and device_id=p_device_id;
end; $$;

create or replace function public.claim_agenda_push_delivery(
  p_subscription_id uuid,p_event_key text,p_source_type text,p_source_id uuid,
  p_source_due_date date,p_reminder_date date,p_vapid_public_key text
) returns table(delivery_id uuid,endpoint text,p256dh text,auth_key text)
language plpgsql security definer set search_path = public as $$
declare v_subscription public.web_push_subscriptions%rowtype; v_id uuid; v_task public.tasks%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'push_server_only' using errcode='42501'; end if;
  if p_reminder_date <> (now() at time zone 'America/Montevideo')::date then return; end if;
  select * into v_subscription from public.web_push_subscriptions s where s.id=p_subscription_id
    and s.enabled and s.vapid_public_key=p_vapid_public_key and (s.expires_at is null or s.expires_at>now()) for update;
  if not found or not exists(select 1 from public.organization_members m where
    m.organization_id=v_subscription.organization_id and m.user_id=v_subscription.user_id and m.is_active) then return; end if;
  if p_source_type='task' then
    select * into v_task from public.tasks t where t.id=p_source_id and t.organization_id=v_subscription.organization_id
      and t.status in ('pending','in_progress','blocked') and t.due_date=p_source_due_date and t.due_date=p_reminder_date;
    if not found then return; end if;
    if v_task.metadata_json->>'task_purpose'='two_day_maturity_reminder' then
      if v_task.metadata_json->>'maturity_date' is distinct from (p_reminder_date+2)::text
        or (v_task.metadata_json ? 'reminder_date' and v_task.metadata_json->>'reminder_date' is distinct from p_reminder_date::text)
      then return; end if;
      if exists(select 1 from public.tasks twin where twin.organization_id=v_subscription.organization_id
        and twin.due_date=p_reminder_date and twin.status in ('done','cancelled')
        and twin.metadata_json->>'task_purpose'='two_day_maturity_reminder'
        and twin.metadata_json->>'maturity_date'=(p_reminder_date+2)::text
        and (twin.metadata_json->>'obligation_id'=v_task.metadata_json->>'obligation_id'
          or (twin.party_id=v_task.party_id and twin.metadata_json->>'operation_number'=v_task.metadata_json->>'operation_number')))
      then return; end if;
      if exists(select 1 from public.obligation_occurrences oc join public.obligations o
        on o.id=oc.obligation_id and o.organization_id=oc.organization_id
        where oc.organization_id=v_subscription.organization_id and oc.due_date=p_reminder_date+2 and oc.status<>'pending'
          and (oc.task_id=v_task.id or o.id::text=v_task.metadata_json->>'obligation_id'
            or (o.party_id=v_task.party_id and o.metadata_json->>'operation_number'=v_task.metadata_json->>'operation_number')))
      then return; end if;
    end if;
    if v_task.metadata_json->>'obligation_id' is not null and not exists(select 1 from public.obligations o
      where o.id::text=v_task.metadata_json->>'obligation_id' and o.organization_id=v_subscription.organization_id and o.status='active'
      and (not (o.metadata_json ? 'current_due_date') or o.metadata_json->>'current_due_date'=coalesce(v_task.metadata_json->>'maturity_date',v_task.due_date::text))
      and (o.frequency not in ('once','ad_hoc') or o.next_due_date::text=coalesce(v_task.metadata_json->>'maturity_date',v_task.due_date::text))) then return; end if;
  elsif p_source_type='obligation' then
    if p_source_due_date <> p_reminder_date+2 or not exists(select 1 from public.obligation_occurrences oc
      join public.obligations o on o.id=oc.obligation_id and o.organization_id=oc.organization_id
      where oc.id=p_source_id and oc.organization_id=v_subscription.organization_id and oc.status='pending'
      and oc.due_date=p_source_due_date and o.status='active'
      and (not (o.metadata_json ? 'current_due_date') or o.metadata_json->>'current_due_date'=oc.due_date::text)
      and (o.frequency not in ('once','ad_hoc') or o.next_due_date=oc.due_date)
      and not exists(select 1 from public.tasks twin where twin.organization_id=oc.organization_id
        and twin.due_date=p_reminder_date and twin.status in ('done','cancelled')
        and (twin.id=oc.task_id or (twin.metadata_json->>'task_purpose'='two_day_maturity_reminder'
          and twin.metadata_json->>'maturity_date'=oc.due_date::text
          and (twin.metadata_json->>'obligation_id'=o.id::text
            or (twin.party_id=o.party_id and twin.metadata_json->>'operation_number'=o.metadata_json->>'operation_number')))))
      and not exists(select 1 from public.obligation_occurrences closed join public.obligations other
        on other.id=closed.obligation_id and other.organization_id=closed.organization_id
        where closed.organization_id=oc.organization_id and closed.due_date=oc.due_date and closed.status<>'pending'
        and (other.id=o.id or (other.party_id=o.party_id and other.metadata_json->>'operation_number'=o.metadata_json->>'operation_number')))) then return; end if;
  elsif p_source_type='test' then
    if p_source_id is not null or p_source_due_date<>p_reminder_date then return; end if;
  else return;
  end if;
  insert into public.web_push_deliveries(organization_id,user_id,device_id,subscription_id,endpoint_hash,event_key,source_type,source_id,source_due_date,reminder_date)
    values(v_subscription.organization_id,v_subscription.user_id,v_subscription.device_id,v_subscription.id,v_subscription.endpoint_hash,p_event_key,p_source_type,p_source_id,p_source_due_date,p_reminder_date)
    on conflict (organization_id,user_id,device_id,event_key) do nothing returning id into v_id;
  if v_id is not null then return query select v_id,v_subscription.endpoint,v_subscription.p256dh,v_subscription.auth_key; end if;
end; $$;

create or replace function public.finish_agenda_push_delivery(p_delivery_id uuid,p_status text,p_provider_status integer,p_result_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_delivery public.web_push_deliveries%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'push_server_only' using errcode='42501'; end if;
  if p_status not in ('accepted','failed','expired','unknown') then raise exception 'push_invalid_result'; end if;
  update public.web_push_deliveries set status=p_status,provider_status=p_provider_status,
    result_code=p_result_code,finished_at=now() where id=p_delivery_id and status='claimed' returning * into v_delivery;
  if not found then return; end if;
  if p_status='expired' and p_provider_status in (404,410) then
    update public.web_push_subscriptions set enabled=false,disabled_reason='provider_expired',updated_at=now()
      where id=v_delivery.subscription_id and endpoint_hash=v_delivery.endpoint_hash;
  elsif p_status='accepted' then
    update public.web_push_subscriptions set last_accepted_at=now()
      where id=v_delivery.subscription_id and endpoint_hash=v_delivery.endpoint_hash;
  end if;
end; $$;

revoke all on function public.register_web_push_subscription(uuid,uuid,text,text,text,text,timestamptz) from public, anon;
revoke all on function public.disable_web_push_subscription(uuid,uuid) from public, anon;
grant execute on function public.register_web_push_subscription(uuid,uuid,text,text,text,text,timestamptz) to authenticated;
grant execute on function public.disable_web_push_subscription(uuid,uuid) to authenticated;
revoke all on function public.claim_agenda_push_delivery(uuid,text,text,uuid,date,date,text) from public, anon, authenticated;
revoke all on function public.finish_agenda_push_delivery(uuid,text,integer,text) from public, anon, authenticated;
grant execute on function public.claim_agenda_push_delivery(uuid,text,text,uuid,date,date,text) to service_role;
grant execute on function public.finish_agenda_push_delivery(uuid,text,integer,text) to service_role;
revoke all on table public.web_push_subscriptions, public.web_push_deliveries from anon, authenticated;
grant select on table public.web_push_subscriptions, public.web_push_deliveries to authenticated;
grant all on table public.web_push_subscriptions, public.web_push_deliveries to service_role;
