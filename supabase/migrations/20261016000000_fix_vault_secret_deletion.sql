
-- Fix deletion of Vault secrets referenced by tooling configurations
-- and storage accounts.
--
-- Supabase Vault does not provide vault.delete_secret(uuid).
-- Delete the secret directly from vault.secrets from within these
-- SECURITY DEFINER functions, preserving the existing access checks.

create or replace function public.delete_tooling_configuration(
  p_id uuid,
  p_organization_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.tooling_configurations%rowtype;
begin
  select *
  into existing
  from public.tooling_configurations
  where id = p_id
    and organization_id = p_organization_id
  for update;

  if not found then
    return false;
  end if;

  if not public.has_organization_access(existing.organization_id) then
    raise exception 'You do not have access to this organization.';
  end if;

  if existing.secret_id is not null then
    delete from vault.secrets
    where id = existing.secret_id;
  end if;

  delete from public.tooling_configurations
  where id = p_id
    and organization_id = p_organization_id;

  return true;
end;
$$;


-- Fix deletion of Vault credentials referenced by storage accounts.

create or replace function public.delete_storage_account(
  p_id uuid,
  p_organization_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.storage_accounts%rowtype;
begin
  select *
  into existing
  from public.storage_accounts
  where id = p_id
    and organization_id = p_organization_id
  for update;

  if not found then
    return false;
  end if;

  if not public.has_organization_access(existing.organization_id) then
    raise exception 'You do not have access to this organization.';
  end if;

  if existing.credential_secret_id is not null then
    delete from vault.secrets
    where id = existing.credential_secret_id;
  end if;

  delete from public.storage_accounts
  where id = p_id
    and organization_id = p_organization_id;

  return true;
end;
$$;