-- =============================================================================
-- Column-level guard on profiles.
--
-- Row level security decides which ROWS you may touch, never which COLUMNS.
-- profiles_update_self lets people edit their own row, which on its own would
-- let any staff member set their own role to 'admin'. A BEFORE UPDATE trigger
-- is the standard way to close that.
-- =============================================================================

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- No JWT means this is trusted server-side work: a migration, the service
  -- role, or GoTrue's own connection applying app_metadata. Without this escape
  -- hatch account creation itself is blocked. It is safe because no UPDATE
  -- policy on profiles matches without a JWT, so an anonymous client can never
  -- reach this trigger in the first place.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active then
    raise exception 'Only an administrator may change a role or deactivate an account'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();
