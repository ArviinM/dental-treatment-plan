-- =============================================================================
-- Storage buckets.
--
-- staff-photos   PUBLIC  — professional headshots, already on the clinic's own
--                          website. The admin UI shows them directly, so a
--                          public bucket avoids signing every thumbnail.
-- plan-templates PRIVATE — blank plan and team artwork. Nothing needs to reach
--                          a browser: the renderer reads these server-side with
--                          the service role, so there is no reason to publish
--                          them.
--
-- Neither bucket holds patient data, and nothing patient-identifying may ever be
-- written to storage without revisiting this file.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-photos',
  'staff-photos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'plan-templates',
  'plan-templates',
  false,
  26214400, -- 25 MB; the team page PDFs are image-heavy
  array['application/pdf']
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- staff-photos
-- -----------------------------------------------------------------------------

create policy "staff photos are publicly readable"
  on storage.objects for select to public
  using (bucket_id = 'staff-photos');

create policy "admins may upload staff photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-photos' and public.is_admin());

create policy "admins may replace staff photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'staff-photos' and public.is_admin())
  with check (bucket_id = 'staff-photos' and public.is_admin());

create policy "admins may delete staff photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'staff-photos' and public.is_admin());

-- -----------------------------------------------------------------------------
-- plan-templates
--
-- The team never reads these from the browser — the server renders with them —
-- so there is no select policy for authenticated users at all. The service role
-- bypasses RLS and is how the renderer fetches them.
-- -----------------------------------------------------------------------------

create policy "admins may read plan templates"
  on storage.objects for select to authenticated
  using (bucket_id = 'plan-templates' and public.is_admin());

create policy "admins may upload plan templates"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'plan-templates' and public.is_admin());

create policy "admins may replace plan templates"
  on storage.objects for update to authenticated
  using (bucket_id = 'plan-templates' and public.is_admin())
  with check (bucket_id = 'plan-templates' and public.is_admin());

create policy "admins may delete plan templates"
  on storage.objects for delete to authenticated
  using (bucket_id = 'plan-templates' and public.is_admin());
