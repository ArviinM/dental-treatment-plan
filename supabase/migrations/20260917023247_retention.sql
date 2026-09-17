-- =============================================================================
-- Retention and deletion for patient data.
--
-- Health records in Victoria generally must be kept for 7 years from the last
-- service, and for a patient who was a child, until they turn 25. So a plan is
-- never deleted outright: "delete" hides it, and a purge job erases it once the
-- retention period has actually expired.
--
-- THE PERIOD BELOW IS A DEFAULT, NOT LEGAL ADVICE. Confirm it with whoever
-- advises the practice before this runs against real records.
-- =============================================================================

-- Kept as a function rather than a literal so the period is changed in exactly
-- one place, and so the change shows up in migration history.
create or replace function public.default_retention_years()
returns integer
language sql
immutable
as $$
  select 7
$$;

-- Soft-deletes a plan and starts its retention clock.
--
-- SECURITY DEFINER because there is deliberately no DELETE policy on
-- treatment_plans; this is the only supported way to remove one. The caller's
-- rights are checked explicitly first.
create or replace function public.soft_delete_treatment_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if not public.is_active_user() then
    raise exception 'You must be signed in to delete a treatment plan'
      using errcode = '42501';
  end if;

  update public.treatment_plans
     set deleted_at  = now(),
         deleted_by  = v_actor,
         purge_after = (current_date + (public.default_retention_years() * interval '1 year'))::date
   where id = p_plan_id
     and deleted_at is null;

  if not found then
    raise exception 'That treatment plan does not exist, or was already deleted'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.soft_delete_treatment_plan(uuid) from public, anon;
grant execute on function public.soft_delete_treatment_plan(uuid) to authenticated;

-- Erases soft-deleted plans whose retention period has passed, and expired
-- history entries. Children go with their parent through ON DELETE CASCADE.
--
-- Not granted to anyone: this runs as the service role, from a scheduled job.
-- Returns what it removed so the job can be logged.
create or replace function public.purge_expired_records()
returns table (purged_plans integer, purged_activity integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plans    integer;
  v_activity integer;
begin
  with deleted as (
    delete from public.treatment_plans
     where deleted_at is not null
       and purge_after is not null
       and purge_after <= current_date
    returning 1
  )
  select count(*)::integer into v_plans from deleted;

  with deleted as (
    delete from public.activity_log
     where purge_after is not null
       and purge_after <= current_date
    returning 1
  )
  select count(*)::integer into v_activity from deleted;

  return query select v_plans, v_activity;
end;
$$;

-- Revoking from `public` drops the default grant, so the scheduled job's role
-- needs EXECUTE naming it explicitly. service_role bypasses RLS but is still
-- subject to ordinary function grants.
revoke all on function public.purge_expired_records() from public, anon, authenticated;
grant execute on function public.purge_expired_records() to service_role;

-- History entries that name a patient inherit the plan's retention period.
-- Entries that do not (a fee change, a new account) are kept indefinitely:
-- they are an administrative record, not health information.
create or replace function public.set_activity_log_retention()
returns trigger
language plpgsql
as $$
begin
  if new.purge_after is null and new.entity_type = 'treatment_plan' then
    new.purge_after :=
      (current_date + (public.default_retention_years() * interval '1 year'))::date;
  end if;

  return new;
end;
$$;

create trigger activity_log_set_retention
  before insert on public.activity_log
  for each row execute function public.set_activity_log_retention();
