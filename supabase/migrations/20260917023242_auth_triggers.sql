-- =============================================================================
-- Keeping public.profiles in step with auth.users.
--
-- The load-bearing rule: ROLE COMES FROM app_metadata, NEVER user_metadata.
-- A signed-in user can write their own user_metadata but cannot touch
-- app_metadata, which needs the service-role key. So app_metadata is the only
-- trustworthy channel for privilege.
-- =============================================================================

-- Fires when an account is created, whether by admin.createUser or by a signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, role, full_name, email, must_change_password)
  values (
    new.id,
    coalesce(
      nullif(new.raw_app_meta_data ->> 'role', '')::public.app_role,
      'staff'
    ),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), new.email),
    new.email,
    coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The second trigger exists because of a real ordering trap.
--
-- GoTrue's admin.createUser INSERTs the user first and applies app_metadata in
-- a FOLLOW-UP UPDATE. The insert trigger above therefore never sees a supplied
-- role, and every account — including admins — would be silently created as
-- staff. This syncs the role across when that update lands.
create or replace function public.sync_profile_from_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role  public.app_role;
  v_force boolean;
begin
  v_role  := nullif(new.raw_app_meta_data ->> 'role', '')::public.app_role;
  v_force := (new.raw_app_meta_data ->> 'must_change_password')::boolean;

  if v_role is null and v_force is null then
    return new;
  end if;

  update public.profiles
     set role                 = coalesce(v_role, role),
         must_change_password = coalesce(v_force, must_change_password)
   where id = new.id
     and (
       (v_role is not null and role is distinct from v_role)
       or
       (v_force is not null and must_change_password is distinct from v_force)
     );

  return new;
end;
$$;

create trigger on_auth_user_app_metadata_changed
  after update of raw_app_meta_data on auth.users
  for each row
  when (new.raw_app_meta_data is distinct from old.raw_app_meta_data)
  execute function public.sync_profile_from_app_metadata();

-- Keep the profile's email in step with a changed sign-in address.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
     set email = new.email
   where id = new.id
     and email is distinct from new.email;

  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.sync_profile_email();
