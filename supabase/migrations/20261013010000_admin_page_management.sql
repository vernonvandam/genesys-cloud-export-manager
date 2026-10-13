create or replace function public.list_local_users()
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_global_admin() then
    raise exception 'Global administrator access is required.';
  end if;
  return query
    select jsonb_build_object(
      'id', p.id,
      'email', u.email,
      'display_name', p.display_name,
      'company_name', p.company_name,
      'role', p.role,
      'approval_status', p.approval_status,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'organizations', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.name)
        from public.organization_memberships m
        join public.organizations o on o.id = m.organization_id
        where m.user_id = p.id
      ), '[]'::jsonb)
    )
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'member'
    order by p.created_at desc;
end;
$$;

create or replace function public.list_organizations_admin()
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_global_admin() then
    raise exception 'Global administrator access is required.';
  end if;
  return query
    select jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'region', o.region,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'local_user_count', (
        select count(*) from public.organization_memberships m
        where m.organization_id = o.id
      ),
      'integrated_user_count', (
        select count(*) from public.integrated_users i
        where i.organization_id = o.id
      ),
      'tooling_count', (
        select count(*) from public.tooling_configurations c
        where c.organization_id = o.id
      ),
      'storage_count', (
        select count(*) from public.storage_accounts s
        where s.organization_id = o.id
      )
    )
    from public.organizations o
    order by o.name;
end;
$$;

create or replace function public.save_organization(
  p_id text,
  p_name text,
  p_region text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.organizations%rowtype;
begin
  if not public.is_global_admin() then
    raise exception 'Global administrator access is required.';
  end if;
  if nullif(trim(p_id), '') is null or nullif(trim(p_name), '') is null then
    raise exception 'Organization ID and name are required.';
  end if;

  insert into public.organizations (id, name, region)
  values (trim(p_id), trim(p_name), nullif(trim(coalesce(p_region, '')), ''))
  on conflict (id) do update
    set name = excluded.name,
        region = excluded.region,
        updated_at = now()
  returning * into saved;

  return jsonb_build_object(
    'id', saved.id,
    'name', saved.name,
    'region', saved.region,
    'created_at', saved.created_at,
    'updated_at', saved.updated_at
  );
end;
$$;

create or replace function public.delete_organization(p_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.organizations%rowtype;
begin
  if not public.is_global_admin() then
    raise exception 'Global administrator access is required.';
  end if;
  select * into existing
  from public.organizations
  where id = p_id
  for update;
  if not found then
    return false;
  end if;
  if exists (
    select 1 from public.organization_memberships where organization_id = p_id
    union all
    select 1 from public.integrated_users where organization_id = p_id
    union all
    select 1 from public.access_requests
    where requested_organization_id = p_id and status = 'pending'
    union all
    select 1 from public.tooling_configurations where organization_id = p_id
    union all
    select 1 from public.storage_accounts where organization_id = p_id
    union all
    select 1 from public.storage_account_test_logs where organization_id = p_id
  ) then
    raise exception 'This organization still has users, access requests, or configuration data. Remove those assignments and records before deleting it.';
  end if;

  delete from public.organizations where id = p_id;
  return true;
end;
$$;

create or replace function public.update_local_user(
  p_user_id uuid,
  p_display_name text,
  p_company_name text,
  p_approval_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_global_admin() then
    raise exception 'Global administrator access is required.';
  end if;
  if p_approval_status is null
     or p_approval_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid approval status.';
  end if;
  if nullif(trim(p_display_name), '') is null then
    raise exception 'Display name is required.';
  end if;
  update public.profiles
    set display_name = trim(p_display_name),
        company_name = nullif(trim(coalesce(p_company_name, '')), ''),
        approval_status = p_approval_status,
        updated_at = now()
    where id = p_user_id and role = 'member';
  if not found then
    raise exception 'Local user not found or cannot be managed.';
  end if;
end;
$$;

create or replace function public.remove_user_organization(
  p_user_id uuid,
  p_organization_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_global_admin() then
    raise exception 'Global administrator access is required.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'member'
  ) then
    raise exception 'Local user not found or cannot be managed.';
  end if;
  delete from public.organization_memberships
  where user_id = p_user_id and organization_id = p_organization_id;
  return found;
end;
$$;

revoke all on function public.list_organizations_admin() from public, anon;
revoke all on function public.save_organization(text, text, text) from public, anon;
revoke all on function public.delete_organization(text) from public, anon;
revoke all on function public.update_local_user(uuid, text, text, text) from public, anon;
revoke all on function public.remove_user_organization(uuid, text) from public, anon;
grant execute on function public.list_organizations_admin() to authenticated;
grant execute on function public.save_organization(text, text, text) to authenticated;
grant execute on function public.delete_organization(text) to authenticated;
grant execute on function public.update_local_user(uuid, text, text, text) to authenticated;
grant execute on function public.remove_user_organization(uuid, text) to authenticated;
