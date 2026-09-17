-- =============================================================================
-- Row level security.
--
-- Access model (from the approved plan):
--
--   treatment_plans + children   admin: all      staff: all
--   activity_log                 admin: read     staff: insert only
--   fee_items                    admin: all      staff: create + edit, no delete
--   clinics, staff_members,
--   templates, template_settings admin: all      staff: read only
--   profiles                     admin: all      staff: own row only
--
-- The fee schedule stays editable by everyone because it always has been —
-- taking that away would change how the team works. Only DELETE is restricted,
-- since a deletion is the one change you cannot notice by reading the list
-- afterwards. Every edit is recorded in activity_log instead.
--
-- Every table is enabled below. Anything left out would be world readable.
-- =============================================================================

alter table public.profiles                 enable row level security;
alter table public.clinics                  enable row level security;
alter table public.staff_members            enable row level security;
alter table public.staff_member_clinics     enable row level security;
alter table public.fee_items                enable row level security;
alter table public.templates                enable row level security;
alter table public.template_settings        enable row level security;
alter table public.treatment_plans          enable row level security;
alter table public.treatment_plan_items     enable row level security;
alter table public.treatment_plan_item_fees enable row level security;
alter table public.activity_log             enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

-- A user may edit their own row, but not their role or whether they are active;
-- that is enforced by the guard trigger, because RLS cannot restrict columns.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Reference data: readable by the whole team, writable by an admin
-- -----------------------------------------------------------------------------

create policy clinics_select_all on public.clinics
  for select to authenticated
  using (public.is_active_user());

create policy clinics_admin_all on public.clinics
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy staff_members_select_all on public.staff_members
  for select to authenticated
  using (public.is_active_user());

create policy staff_members_admin_all on public.staff_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy staff_member_clinics_select_all on public.staff_member_clinics
  for select to authenticated
  using (public.is_active_user());

create policy staff_member_clinics_admin_all on public.staff_member_clinics
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy templates_select_all on public.templates
  for select to authenticated
  using (public.is_active_user());

create policy templates_admin_all on public.templates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy template_settings_select_all on public.template_settings
  for select to authenticated
  using (public.is_active_user());

create policy template_settings_admin_all on public.template_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- fee_items: the whole team may add and edit; only an admin may delete
-- -----------------------------------------------------------------------------

create policy fee_items_select_all on public.fee_items
  for select to authenticated
  using (public.is_active_user());

create policy fee_items_insert_staff on public.fee_items
  for insert to authenticated
  with check (public.is_active_user());

create policy fee_items_update_staff on public.fee_items
  for update to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

create policy fee_items_delete_admin on public.fee_items
  for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Treatment plans: every signed-in user, no clinic scoping
--
-- Soft-deleted plans stay readable to an admin only. They are retained for a
-- legal period rather than removed, so they must not keep appearing in the
-- team's everyday lists.
-- -----------------------------------------------------------------------------

create policy treatment_plans_select on public.treatment_plans
  for select to authenticated
  using (public.is_active_user() and (deleted_at is null or public.is_admin()));

create policy treatment_plans_insert on public.treatment_plans
  for insert to authenticated
  with check (public.is_active_user());

create policy treatment_plans_update on public.treatment_plans
  for update to authenticated
  using (public.is_active_user() and (deleted_at is null or public.is_admin()))
  with check (public.is_active_user());

-- No DELETE policy by design. Removal goes through the soft-delete path so the
-- retention clock is respected; only the purge job may erase a row, and it runs
-- as the service role, which bypasses RLS.

create policy treatment_plan_items_all on public.treatment_plan_items
  for all to authenticated
  using (
    exists (
      select 1 from public.treatment_plans p
       where p.id = treatment_plan_items.plan_id
         and public.is_active_user()
         and (p.deleted_at is null or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.treatment_plans p
       where p.id = treatment_plan_items.plan_id
         and public.is_active_user()
         and p.deleted_at is null
    )
  );

create policy treatment_plan_item_fees_all on public.treatment_plan_item_fees
  for all to authenticated
  using (
    exists (
      select 1
        from public.treatment_plan_items i
        join public.treatment_plans p on p.id = i.plan_id
       where i.id = treatment_plan_item_fees.item_id
         and public.is_active_user()
         and (p.deleted_at is null or public.is_admin())
    )
  )
  with check (
    exists (
      select 1
        from public.treatment_plan_items i
        join public.treatment_plans p on p.id = i.plan_id
       where i.id = treatment_plan_item_fees.item_id
         and public.is_active_user()
         and p.deleted_at is null
    )
  );

-- -----------------------------------------------------------------------------
-- activity_log: append-only for the team, readable by an admin
--
-- The insert check pins actor_id to the caller, so an entry cannot be written
-- in someone else's name. There is deliberately no UPDATE or DELETE policy:
-- history that the people making it can rewrite is not history.
-- -----------------------------------------------------------------------------

create policy activity_log_select_admin on public.activity_log
  for select to authenticated
  using (public.is_admin());

create policy activity_log_insert_self on public.activity_log
  for insert to authenticated
  with check (public.is_active_user() and actor_id = auth.uid());
