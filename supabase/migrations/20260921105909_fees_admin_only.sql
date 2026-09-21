-- =============================================================================
-- The fee schedule becomes admin-only to change.
--
-- It started editable by the whole team, deliberately: the old app kept a copy
-- in each browser that anyone could edit, and the rebuild tried not to take
-- abilities away from people. Ericka has since asked for the opposite — only she
-- and the practice owner should be able to change prices — and prices are the
-- one thing on a treatment plan a patient is asked to agree to.
--
-- Staff can still READ every fee; they need to, to build a plan. They can no
-- longer add, edit, import or delete one. Deleting was already admin-only.
--
-- Enforced here, in row level security, not only in the app. A hidden button
-- is not a permission: without this, the same edit sent straight to the API by
-- any signed-in staff account would still have been accepted.
-- =============================================================================

drop policy if exists fee_items_insert_staff on public.fee_items;
drop policy if exists fee_items_update_staff on public.fee_items;

create policy fee_items_insert_admin on public.fee_items
  for insert to authenticated
  with check (public.is_admin());

create policy fee_items_update_admin on public.fee_items
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- fee_items_select_all (every signed-in user) and fee_items_delete_admin are
-- unchanged.
