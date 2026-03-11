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

revoke all on function public.list_dashboard_documents(uuid, integer) from public;
grant execute on function public.list_dashboard_documents(uuid, integer) to authenticated;
grant execute on function public.list_dashboard_documents(uuid, integer) to service_role;
