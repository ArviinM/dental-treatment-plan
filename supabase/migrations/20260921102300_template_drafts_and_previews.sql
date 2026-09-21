-- =============================================================================
-- Template drafts, and preview images of the real artwork.
--
-- Written after a production incident. Ericka uploaded her Canva master as the
-- plan template; it had the treatment table and the cover heading already
-- printed on it, so every PDF came out with two tables and two headings on top
-- of each other. It went live instantly, for everyone, and the live preview
-- showed the ORIGINAL artwork — so nothing on screen suggested anything was
-- wrong. Two changes follow from that.
--
-- 1. Uploads land as DRAFTS. A draft never affects a real plan. The admin looks
--    at a sample plan rendered on it, then publishes. published_at separates a
--    draft (never live) from a superseded version (was live, since replaced).
--
-- 2. Every template carries PNG previews of the pages the canvas preview draws.
--    The preview used to paint the bundled originals whatever was uploaded, so
--    it could disagree with the PDF it was previewing. PDF pages cannot be
--    rasterised on the server without native dependencies, so the browser
--    renders these at upload time and they live beside the PDF.
-- =============================================================================

alter table public.templates
  add column if not exists published_at timestamptz,
  add column if not exists preview_paths text[] not null default '{}';

-- Everything that exists today went live the moment it was uploaded.
update public.templates
   set published_at = created_at
 where published_at is null;

create index if not exists templates_drafts_idx
  on public.templates (kind, clinic_id)
  where published_at is null;

-- -----------------------------------------------------------------------------
-- Preview images.
--
-- Public, like staff-photos: this is the patient-facing artwork — the cover and
-- the team pages that go out on every plan — and the canvas preview loads it
-- straight into an <img>. No patient data is ever written here.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('template-previews', 'template-previews', true, 10485760, array['image/png'])
on conflict (id) do nothing;

create policy "template previews are publicly readable"
  on storage.objects for select to public
  using (bucket_id = 'template-previews');

create policy "admins may upload template previews"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'template-previews' and public.is_admin());

create policy "admins may replace template previews"
  on storage.objects for update to authenticated
  using (bucket_id = 'template-previews' and public.is_admin())
  with check (bucket_id = 'template-previews' and public.is_admin());

create policy "admins may delete template previews"
  on storage.objects for delete to authenticated
  using (bucket_id = 'template-previews' and public.is_admin());
