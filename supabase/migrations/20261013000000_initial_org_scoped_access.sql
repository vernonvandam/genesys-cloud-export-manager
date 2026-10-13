create extension if not exists pgcrypto;
create extension if not exists supabase_vault with schema vault;

create table public.organizations (
  id text primary key,
  name text not null,
  region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  company_name text,
  role text not null default 'member' check (role in ('member', 'global_admin')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  onboarding_completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  requested_organization_id text not null,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  user_id uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id text not null references public.organizations(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create table public.integrated_users (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  genesys_user_id text not null,
  name text not null,
  username text,
  email text,
  region text not null,
  first_login_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, genesys_user_id)
);

create table public.tooling_configurations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  environment text not null default 'Production',
  endpoint text not null default '',
  description text not null default '',
  enabled boolean not null default true,
  grant_type text not null default 'client_credentials' check (grant_type = 'client_credentials'),
  client_id text not null,
  secret_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.storage_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  provider text not null check (provider in ('cloudflare-r2', 'google-cloud-storage', 'azure-blob', 'aws-s3', 'oracle-object-storage')),
  environment text not null default 'Production',
  enabled boolean not null default false,
  description text not null default '',
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  credential_secret_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.storage_account_test_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  storage_account_id uuid not null references public.storage_accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  storage_account_name text not null,
  provider text not null,
  status text not null check (status in ('passed', 'failed')),
  report jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now()
);

create index organization_memberships_user_idx on public.organization_memberships(user_id);
create index integrated_users_org_idx on public.integrated_users(organization_id);
create index tooling_configurations_org_idx on public.tooling_configurations(organization_id);
create index storage_accounts_org_idx on public.storage_accounts(organization_id);
create index storage_test_logs_org_finished_idx on public.storage_account_test_logs(organization_id, finished_at desc);

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'global_admin'
      and p.approval_status = 'approved'
      and not exists (
        select 1
        from auth.users u
        join public.integrated_users i on lower(i.email) = lower(u.email)
        where u.id = (select auth.uid())
      )
  );
$$;

create or replace function public.has_organization_access(p_organization_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.role() = 'service_role', false)
    or public.is_global_admin()
    or exists (
      select 1
      from public.organization_memberships m
      join public.profiles p on p.id = m.user_id
      where m.user_id = (select auth.uid())
        and m.organization_id = p_organization_id
        and p.approval_status = 'approved'
        and not exists (
          select 1
          from auth.users u
          join public.integrated_users i on lower(i.email) = lower(u.email)
          where u.id = (select auth.uid())
        )
    );
$$;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
  access_request public.access_requests%rowtype;
begin
  select * into access_request
  from public.access_requests r
  where r.email = normalized_email;

  insert into public.profiles (id, display_name, approval_status)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), normalized_email),
    case when access_request.status = 'approved' then 'approved' else 'pending' end
  )
  on conflict (id) do nothing;

  if found then
    update public.access_requests
      set user_id = new.id, updated_at = now()
      where email = normalized_email;

    if access_request.status = 'approved' then
      insert into public.organizations (id, name)
      values (access_request.requested_organization_id, access_request.requested_organization_id)
      on conflict (id) do nothing;
      insert into public.organization_memberships (user_id, organization_id)
      values (new.id, access_request.requested_organization_id)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create or replace function public.get_my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_profile public.profiles%rowtype;
begin
  select * into current_profile from public.profiles where id = (select auth.uid());
  if not found then
    return null;
  end if;
  if exists (
    select 1
    from auth.users u
    join public.integrated_users i on lower(i.email) = lower(u.email)
    where u.id = (select auth.uid())
  ) then
    raise exception 'This identity uses Genesys-integrated sign-in. Open Export Manager from Genesys Cloud.';
  end if;

  return jsonb_build_object(
    'profile', to_jsonb(current_profile),
    'organizations', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'region', o.region) order by o.name)
      from public.organizations o
      where (current_profile.approval_status = 'approved' and public.is_global_admin())
         or exists (
           select 1 from public.organization_memberships m
           where current_profile.approval_status = 'approved'
             and m.user_id = current_profile.id
             and m.organization_id = o.id
         )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.list_access_requests()
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
      'id', r.id,
      'email', r.email,
      'display_name', r.display_name,
      'requested_organization_id', r.requested_organization_id,
      'message', r.message,
      'status', r.status,
      'created_at', r.created_at,
      'user_id', r.user_id
    )
    from public.access_requests r
    order by case when r.status = 'pending' then 0 else 1 end, r.created_at;
end;
$$;

create or replace function public.review_access_request(p_request_id uuid, p_approve boolean, p_organization_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.access_requests%rowtype;
  linked_user_id uuid;
begin
  if not public.is_global_admin() then
    raise exception 'Global administrator access is required.';
  end if;
  select * into request_row from public.access_requests where id = p_request_id for update;
  if not found then
    raise exception 'Access request not found.';
  end if;

  update public.access_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_by = (select auth.uid()),
        reviewed_at = now(),
        updated_at = now()
    where id = p_request_id;

  linked_user_id := request_row.user_id;
  if linked_user_id is null then
    select u.id into linked_user_id
    from auth.users u
    where lower(u.email) = request_row.email
    limit 1;
    update public.access_requests set user_id = linked_user_id where id = p_request_id;
  end if;

  if p_approve then
    insert into public.organizations (id, name)
    values (
      request_row.requested_organization_id,
      coalesce(nullif(trim(p_organization_name), ''), request_row.requested_organization_id)
    )
    on conflict (id) do update
      set name = excluded.name, updated_at = now();

    if linked_user_id is not null then
      update public.profiles set approval_status = 'approved', updated_at = now()
      where id = linked_user_id;
      insert into public.organization_memberships (user_id, organization_id, assigned_by)
      values (linked_user_id, request_row.requested_organization_id, (select auth.uid()))
      on conflict do nothing;
    end if;
  elsif linked_user_id is not null then
    update public.profiles set approval_status = 'rejected', updated_at = now()
    where id = linked_user_id;
  end if;
end;
$$;

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
      'role', p.role,
      'approval_status', p.approval_status,
      'organizations', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.name)
        from public.organization_memberships m
        join public.organizations o on o.id = m.organization_id
        where m.user_id = p.id
      ), '[]'::jsonb)
    )
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role <> 'global_admin'
    order by p.created_at desc;
end;
$$;

create or replace function public.assign_user_organization(p_user_id uuid, p_organization_id text, p_organization_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_global_admin() then
    raise exception 'Global administrator access is required.';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.approval_status = 'approved' and p.role = 'member'
  ) then
    raise exception 'Only approved local users can receive organization assignments.';
  end if;
  if nullif(trim(p_organization_id), '') is null then
    raise exception 'Organization ID is required.';
  end if;

  insert into public.organizations (id, name)
  values (p_organization_id, coalesce(nullif(trim(p_organization_name), ''), p_organization_id))
  on conflict (id) do update set name = excluded.name, updated_at = now();

  insert into public.organization_memberships (user_id, organization_id, assigned_by)
  values (p_user_id, p_organization_id, (select auth.uid()))
  on conflict do nothing;
end;
$$;

create or replace function public.list_tooling_configurations(p_organization_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'organization_id', c.organization_id,
      'name', c.name,
      'environment', c.environment,
      'endpoint', c.endpoint,
      'description', c.description,
      'enabled', c.enabled,
      'grant_type', c.grant_type,
      'client_id', c.client_id,
      'has_secret', c.secret_id is not null,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    ) order by c.created_at desc)
    from public.tooling_configurations c
    where (p_organization_id is null or c.organization_id = p_organization_id)
      and public.has_organization_access(c.organization_id)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.save_tooling_configuration(
  p_id uuid,
  p_organization_id text,
  p_name text,
  p_environment text,
  p_endpoint text,
  p_description text,
  p_enabled boolean,
  p_grant_type text,
  p_client_id text,
  p_client_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.tooling_configurations%rowtype;
  new_secret_id uuid;
begin
  if not public.has_organization_access(p_organization_id) then
    raise exception 'You do not have access to this organization.';
  end if;
  if nullif(trim(p_name), '') is null or nullif(trim(p_client_id), '') is null then
    raise exception 'A configuration name and OAuth client ID are required.';
  end if;
  if p_id is null and nullif(p_client_secret, '') is null then
    raise exception 'A client secret is required for a new tooling configuration.';
  end if;

  if p_id is not null then
    select * into saved from public.tooling_configurations
    where id = p_id and organization_id = p_organization_id for update;
    if not found then
      raise exception 'Tooling configuration not found.';
    end if;
  end if;

  if nullif(p_client_secret, '') is not null then
    if saved.secret_id is null then
      new_secret_id := vault.create_secret(p_client_secret);
    else
      perform vault.update_secret(saved.secret_id, p_client_secret);
      new_secret_id := saved.secret_id;
    end if;
  else
    new_secret_id := saved.secret_id;
  end if;

  if p_id is null then
    insert into public.tooling_configurations (
      organization_id, created_by, name, environment, endpoint, description,
      enabled, grant_type, client_id, secret_id
    ) values (
      p_organization_id, (select auth.uid()), trim(p_name), coalesce(p_environment, 'Production'),
      coalesce(p_endpoint, ''), coalesce(p_description, ''), coalesce(p_enabled, true),
      coalesce(p_grant_type, 'client_credentials'), trim(p_client_id), new_secret_id
    ) returning * into saved;
  else
    update public.tooling_configurations set
      name = trim(p_name), environment = coalesce(p_environment, 'Production'),
      endpoint = coalesce(p_endpoint, ''), description = coalesce(p_description, ''),
      enabled = coalesce(p_enabled, true), grant_type = coalesce(p_grant_type, 'client_credentials'),
      client_id = trim(p_client_id), secret_id = new_secret_id, updated_at = now()
    where id = p_id and organization_id = p_organization_id returning * into saved;
  end if;

  return jsonb_build_object(
    'id', saved.id, 'organization_id', saved.organization_id, 'name', saved.name,
    'environment', saved.environment, 'endpoint', saved.endpoint,
    'description', saved.description, 'enabled', saved.enabled, 'grant_type', saved.grant_type,
    'client_id', saved.client_id, 'has_secret', saved.secret_id is not null,
    'created_at', saved.created_at, 'updated_at', saved.updated_at
  );
end;
$$;

create or replace function public.delete_tooling_configuration(p_id uuid, p_organization_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.tooling_configurations%rowtype;
begin
  select * into existing from public.tooling_configurations
  where id = p_id and organization_id = p_organization_id for update;
  if not found then return false; end if;
  if not public.has_organization_access(existing.organization_id) then
    raise exception 'You do not have access to this organization.';
  end if;
  if existing.secret_id is not null then perform vault.delete_secret(existing.secret_id); end if;
  delete from public.tooling_configurations where id = p_id;
  return true;
end;
$$;

create or replace function public.list_storage_accounts(p_organization_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'organization_id', s.organization_id, 'name', s.name,
      'provider', s.provider, 'environment', s.environment, 'enabled', s.enabled,
      'description', s.description, 'settings', s.settings,
      'credential_keys', coalesce((
        select jsonb_agg(key order by key)
        from jsonb_object_keys(coalesce(v.decrypted_secret::jsonb, '{}'::jsonb)) as keys(key)
      ), '[]'::jsonb), 'created_at', s.created_at, 'updated_at', s.updated_at
    ) order by s.created_at desc)
    from public.storage_accounts s
    left join vault.decrypted_secrets v on v.id = s.credential_secret_id
    where (p_organization_id is null or s.organization_id = p_organization_id)
      and public.has_organization_access(s.organization_id)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.save_storage_account(
  p_id uuid,
  p_organization_id text,
  p_name text,
  p_provider text,
  p_environment text,
  p_enabled boolean,
  p_description text,
  p_settings jsonb,
  p_credentials jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.storage_accounts%rowtype;
  new_secret_id uuid;
  supplied_secret text;
  saved_credential_keys jsonb := '[]'::jsonb;
begin
  if not public.has_organization_access(p_organization_id) then
    raise exception 'You do not have access to this organization.';
  end if;
  if nullif(trim(p_name), '') is null
    or jsonb_typeof(coalesce(p_settings, '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_credentials, '{}'::jsonb)) <> 'object' then
    raise exception 'A storage account name and valid settings are required.';
  end if;
  if p_id is not null then
    select * into saved from public.storage_accounts
      where id = p_id and organization_id = p_organization_id for update;
    if not found then raise exception 'Storage account not found.'; end if;
  end if;

  supplied_secret := nullif(coalesce(p_credentials, '{}'::jsonb), '{}'::jsonb)::text;
  if supplied_secret is not null then
    if saved.credential_secret_id is null then
      new_secret_id := vault.create_secret(supplied_secret);
    else
      perform vault.update_secret(saved.credential_secret_id, supplied_secret);
      new_secret_id := saved.credential_secret_id;
    end if;
  else
    new_secret_id := saved.credential_secret_id;
  end if;

  if p_id is null then
    insert into public.storage_accounts (
      organization_id, created_by, name, provider, environment, enabled,
      description, settings, credential_secret_id
    ) values (
      p_organization_id, (select auth.uid()), trim(p_name), p_provider,
      coalesce(p_environment, 'Production'), coalesce(p_enabled, false),
      coalesce(p_description, ''), coalesce(p_settings, '{}'::jsonb), new_secret_id
    ) returning * into saved;
  else
    update public.storage_accounts set
      name = trim(p_name), provider = p_provider, environment = coalesce(p_environment, 'Production'),
      enabled = coalesce(p_enabled, false), description = coalesce(p_description, ''),
      settings = coalesce(p_settings, '{}'::jsonb), credential_secret_id = new_secret_id,
      updated_at = now()
    where id = p_id and organization_id = p_organization_id returning * into saved;
  end if;

  if saved.credential_secret_id is not null then
    select coalesce(jsonb_agg(key order by key), '[]'::jsonb) into saved_credential_keys
    from vault.decrypted_secrets v
    cross join lateral jsonb_object_keys(coalesce(v.decrypted_secret::jsonb, '{}'::jsonb)) as keys(key)
    where v.id = saved.credential_secret_id;
  end if;
  return jsonb_build_object(
    'id', saved.id, 'organization_id', saved.organization_id, 'name', saved.name,
    'provider', saved.provider, 'environment', saved.environment, 'enabled', saved.enabled,
    'description', saved.description, 'settings', saved.settings,
    'credential_keys', saved_credential_keys, 'created_at', saved.created_at,
    'updated_at', saved.updated_at
  );
end;
$$;

create or replace function public.delete_storage_account(p_id uuid, p_organization_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.storage_accounts%rowtype;
begin
  select * into existing from public.storage_accounts
  where id = p_id and organization_id = p_organization_id for update;
  if not found then return false; end if;
  if not public.has_organization_access(existing.organization_id) then
    raise exception 'You do not have access to this organization.';
  end if;
  if existing.credential_secret_id is not null then perform vault.delete_secret(existing.credential_secret_id); end if;
  delete from public.storage_accounts where id = p_id;
  return true;
end;
$$;

create or replace function public.get_storage_account_test_config(p_id uuid, p_organization_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account public.storage_accounts%rowtype;
begin
  select * into account from public.storage_accounts
  where id = p_id and organization_id = p_organization_id;
  if not found then raise exception 'Storage account not found.'; end if;
  return jsonb_build_object(
    'id', account.id, 'organization_id', account.organization_id, 'name', account.name,
    'provider', account.provider, 'environment', account.environment, 'enabled', account.enabled,
    'description', account.description, 'settings', account.settings,
    'credentials', coalesce((select v.decrypted_secret::jsonb from vault.decrypted_secrets v where v.id = account.credential_secret_id), '{}'::jsonb)
  );
end;
$$;

create or replace function public.list_storage_account_test_logs(p_organization_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_organization_access(p_organization_id) then
    raise exception 'You do not have access to this organization.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'storage_account_id', l.storage_account_id, 'status', l.status, 'finished_at', l.finished_at) order by l.finished_at desc)
    from public.storage_account_test_logs l where l.organization_id = p_organization_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_storage_account_test_log(p_id uuid, p_organization_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result public.storage_account_test_logs%rowtype;
begin
  if not public.has_organization_access(p_organization_id) then
    raise exception 'You do not have access to this organization.';
  end if;
  select * into result from public.storage_account_test_logs
  where id = p_id and organization_id = p_organization_id;
  if not found then raise exception 'Storage test report not found.'; end if;
  return jsonb_build_object('id', result.id, 'storage_account_id', result.storage_account_id, 'status', result.status, 'finished_at', result.finished_at, 'report', result.report, 'storage_account_name', result.storage_account_name, 'provider', result.provider);
end;
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.access_requests enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.integrated_users enable row level security;
alter table public.tooling_configurations enable row level security;
alter table public.storage_accounts enable row level security;
alter table public.storage_account_test_logs enable row level security;

create policy "read own profile or profiles as global admin" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.is_global_admin());
create policy "read assigned organizations" on public.organizations
for select to authenticated using (public.has_organization_access(id));
create policy "global admins manage access requests" on public.access_requests
for all to authenticated using (public.is_global_admin()) with check (public.is_global_admin());
create policy "read own organization memberships" on public.organization_memberships
for select to authenticated using (
  (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.approval_status = 'approved'
  ))
  or public.is_global_admin()
);
create policy "read org tooling configurations" on public.tooling_configurations
for select to authenticated using (public.has_organization_access(organization_id));
create policy "read org storage accounts" on public.storage_accounts
for select to authenticated using (public.has_organization_access(organization_id));
create policy "read org storage test logs" on public.storage_account_test_logs
for select to authenticated using (public.has_organization_access(organization_id));

revoke all on public.profiles, public.organizations, public.access_requests,
  public.organization_memberships, public.integrated_users,
  public.tooling_configurations, public.storage_accounts,
  public.storage_account_test_logs from public, anon, authenticated;
grant select on public.profiles, public.organizations, public.organization_memberships,
  public.tooling_configurations, public.storage_accounts, public.storage_account_test_logs to authenticated;
revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
revoke all on function public.get_my_access() from public, anon;
revoke all on function public.list_access_requests() from public, anon;
revoke all on function public.review_access_request(uuid, boolean, text) from public, anon;
revoke all on function public.list_local_users() from public, anon;
revoke all on function public.assign_user_organization(uuid, text, text) from public, anon;
revoke all on function public.list_tooling_configurations(text) from public, anon;
revoke all on function public.save_tooling_configuration(uuid, text, text, text, text, text, boolean, text, text, text) from public, anon;
revoke all on function public.delete_tooling_configuration(uuid, text) from public, anon;
revoke all on function public.list_storage_accounts(text) from public, anon;
revoke all on function public.save_storage_account(uuid, text, text, text, text, boolean, text, jsonb, jsonb) from public, anon;
revoke all on function public.delete_storage_account(uuid, text) from public, anon;
revoke all on function public.list_storage_account_test_logs(text) from public, anon;
revoke all on function public.get_storage_account_test_log(uuid, text) from public, anon;
revoke all on function public.get_storage_account_test_config(uuid, text) from public, anon, authenticated;
grant execute on function public.get_my_access() to authenticated;
grant execute on function public.list_access_requests() to authenticated;
grant execute on function public.review_access_request(uuid, boolean, text) to authenticated;
grant execute on function public.list_local_users() to authenticated;
grant execute on function public.assign_user_organization(uuid, text, text) to authenticated;
grant execute on function public.list_tooling_configurations(text) to authenticated, service_role;
grant execute on function public.save_tooling_configuration(uuid, text, text, text, text, text, boolean, text, text, text) to authenticated, service_role;
grant execute on function public.delete_tooling_configuration(uuid, text) to authenticated, service_role;
grant execute on function public.list_storage_accounts(text) to authenticated, service_role;
grant execute on function public.save_storage_account(uuid, text, text, text, text, boolean, text, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.delete_storage_account(uuid, text) to authenticated, service_role;
grant execute on function public.list_storage_account_test_logs(text) to authenticated, service_role;
grant execute on function public.get_storage_account_test_log(uuid, text) to authenticated, service_role;
grant execute on function public.get_storage_account_test_config(uuid, text) to service_role;

revoke all on function public.is_global_admin() from public, anon, authenticated;
revoke all on function public.has_organization_access(text) from public, anon, authenticated;
grant execute on function public.is_global_admin() to authenticated, service_role;
grant execute on function public.has_organization_access(text) to authenticated, service_role;
grant all on public.organizations, public.integrated_users, public.access_requests,
  public.profiles, public.organization_memberships, public.tooling_configurations,
  public.storage_accounts, public.storage_account_test_logs to service_role;
