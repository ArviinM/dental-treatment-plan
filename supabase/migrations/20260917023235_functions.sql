-- =============================================================================
-- Helper functions used by the row level security policies.
--
-- Every one is SECURITY DEFINER. They read public.profiles, and a policy on
-- profiles that called a plain function reading profiles would recurse.
-- search_path is pinned so a caller cannot shadow `profiles` with their own
-- table and talk the function into answering from it.
-- =============================================================================

-- The caller's role, or null when they are signed out, have no profile, or have
-- been deactivated. A disabled account therefore fails every policy below
-- without any policy needing to mention is_active.
create or replace function public.auth_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
    from public.profiles p
   where p.id = auth.uid()
     and p.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

-- Anyone signed in with a live account. Both roles make treatment plans, so
-- this is the ordinary "may use the app" test.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.auth_role() is not null
$$;

revoke all on function public.auth_role()       from public, anon;
revoke all on function public.is_admin()        from public, anon;
revoke all on function public.is_active_user()  from public, anon;

grant execute on function public.auth_role()      to authenticated;
grant execute on function public.is_admin()       to authenticated;
grant execute on function public.is_active_user() to authenticated;
