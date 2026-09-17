-- =============================================================================
-- Fixes raised by `supabase db advisors` after the first push.
--
-- Three real issues out of 26 warnings. The rest of the advisor output is either
-- intentional — the helper functions ARE meant to be callable by signed-in users
-- — or a negligible planner note about tables holding a few hundred rows.
-- =============================================================================

-- 1. Pin search_path on the three functions that were missing it -------------
--
-- Without it, a caller can put their own schema ahead of `public` and change
-- what an unqualified name inside the function body resolves to. Every other
-- function in this schema already pins it; these three were overlooked.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.default_retention_years()
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select 7
$$;

create or replace function public.set_activity_log_retention()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.purge_after is null and new.entity_type = 'treatment_plan' then
    new.purge_after :=
      (current_date + (public.default_retention_years() * interval '1 year'))::date;
  end if;

  return new;
end;
$$;

-- 2. Stop PostgREST publishing the trigger functions as callable RPC ---------
--
-- Postgres grants EXECUTE to `public` on new functions by default, so PostgREST
-- exposes these at /rest/v1/rpc/<name> where anyone with the publishable key can
-- POST to them. They are SECURITY DEFINER, which is what makes the advisor
-- flag it.
--
-- Calling a trigger function outside a trigger raises an error, so this is
-- hardening rather than closing a live hole — but there is no reason to publish
-- them at all.
--
-- The existing triggers keep working: EXECUTE on a trigger function is checked
-- when the TRIGGER IS CREATED, not each time it fires.

revoke all on function public.handle_new_user()                from public, anon, authenticated;
revoke all on function public.sync_profile_from_app_metadata() from public, anon, authenticated;
revoke all on function public.sync_profile_email()             from public, anon, authenticated;
revoke all on function public.guard_profile_privileges()       from public, anon, authenticated;
revoke all on function public.set_updated_at()                 from public, anon, authenticated;
revoke all on function public.set_activity_log_retention()     from public, anon, authenticated;

-- 3. Evaluate auth.uid() once per query instead of once per row -------------
--
-- `id = auth.uid()` is re-run for every row the policy scans. Wrapping it in a
-- scalar subquery lets the planner hoist it into an InitPlan and evaluate it a
-- single time. Identical semantics; it simply stops being O(rows).

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists activity_log_insert_self on public.activity_log;
create policy activity_log_insert_self on public.activity_log
  for insert to authenticated
  with check (public.is_active_user() and actor_id = (select auth.uid()));
