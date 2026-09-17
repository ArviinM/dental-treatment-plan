-- =============================================================================
-- Schedule the retention purge.
--
-- soft_delete_treatment_plan() has been stamping purge_after dates since the
-- retention migration, but nothing was acting on them — so "deleted" plans were
-- being kept forever rather than for a defined period. Holding health
-- information longer than the policy says is its own problem, not a safe
-- default.
--
-- pg_cron rather than an HTTP cron hitting a route handler:
--   - it runs inside the database, where the function already lives
--   - there is no endpoint to secure and no shared secret to leak
--   - it keeps running while the app is down or mid-deploy
-- =============================================================================

create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- A record of every run.
--
-- A purge that cannot be shown to have happened is weak evidence that retention
-- is being honoured. This is that evidence: when the job ran and how much it
-- removed — including the runs that removed nothing, which is most of them.
-- -----------------------------------------------------------------------------

create table if not exists public.purge_run_log (
  id               bigint generated always as identity primary key,
  ran_at           timestamptz not null default now(),
  purged_plans     integer not null default 0,
  purged_activity  integer not null default 0,
  error            text
);

create index if not exists purge_run_log_ran_at_idx on public.purge_run_log (ran_at desc);

alter table public.purge_run_log enable row level security;

-- Readable by an admin. Nothing may write through the API: the job runs as the
-- function owner and is not subject to these policies.
create policy purge_run_log_select_admin on public.purge_run_log
  for select to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- The job body
-- -----------------------------------------------------------------------------

create or replace function public.run_scheduled_purge()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plans    integer := 0;
  v_activity integer := 0;
begin
  select purged_plans, purged_activity
    into v_plans, v_activity
    from public.purge_expired_records();

  insert into public.purge_run_log (purged_plans, purged_activity)
  values (v_plans, v_activity);
exception
  when others then
    -- Record the failure and return normally. Raising would leave cron's own
    -- history as the only trace, and a silently failed run looks exactly like
    -- one that found nothing to do.
    insert into public.purge_run_log (purged_plans, purged_activity, error)
    values (0, 0, sqlerrm);
end;
$$;

revoke all on function public.run_scheduled_purge() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Daily at 16:30 UTC.
--
-- That is roughly 2:30–3:30am in Melbourne depending on daylight saving, well
-- clear of clinic hours either way. Retention is measured in years, so the
-- exact minute does not matter; not running during appointments does.
-- -----------------------------------------------------------------------------

do $$
begin
  -- Re-running this migration must not fail on a duplicate job name.
  if exists (select 1 from cron.job where jobname = 'purge-expired-records') then
    perform cron.unschedule('purge-expired-records');
  end if;

  perform cron.schedule(
    'purge-expired-records',
    '30 16 * * *',
    $job$select public.run_scheduled_purge();$job$
  );
end;
$$;
