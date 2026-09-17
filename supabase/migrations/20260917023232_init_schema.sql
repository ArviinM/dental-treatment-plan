-- =============================================================================
-- SIA Dental — core schema
--
-- Four groups of tables:
--   people      profiles
--   reference   clinics, staff_members, fee_items, templates, template_settings
--   plans       treatment_plans and its children   <- PATIENT DATA
--   audit       activity_log                        <- PATIENT DATA
--
-- The two marked groups hold health information about identifiable people. They
-- carry soft deletion and a retention date; see the retention migration and the
-- "Patient data and privacy" section of the project plan. Under the Privacy Act
-- 1988 (Cth) and the Health Records Act 2001 (Vic) a dental practice is a health
-- service provider, and the small-business exemption does not apply to it.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Enums and shared helpers
-- -----------------------------------------------------------------------------

-- Two roles only. Ericka is the admin; everyone else creates plans.
create type public.app_role as enum ('admin', 'staff');

create type public.template_kind as enum ('plan', 'team');

create type public.plan_status as enum ('draft', 'issued');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- People
-- -----------------------------------------------------------------------------

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  role                  public.app_role not null default 'staff',
  full_name             text not null,
  email                 citext not null,
  is_active             boolean not null default true,
  -- Set when an admin creates or resets an account, so the app can force a
  -- password change at first sign-in.
  must_change_password  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint profiles_full_name_not_blank check (length(btrim(full_name)) > 0)
);

create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Reference data
--
-- All of this is currently hardcoded in src/data and src/types. Moving it here
-- is what lets Ericka change a dentist or a fee without a deploy.
-- -----------------------------------------------------------------------------

create table public.clinics (
  id          uuid primary key default gen_random_uuid(),
  -- Matches the Location union in src/types/index.ts: essendon|burwood|mulgrave.
  slug        text not null unique,
  name        text not null,
  website     text not null default '',
  phone       text not null default '',
  address     text not null default '',
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint clinics_slug_format check (slug ~ '^[a-z][a-z0-9-]{1,40}$')
);

create trigger clinics_set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

create table public.staff_members (
  id                 uuid primary key default gen_random_uuid(),
  -- Stable human-readable key ("dr-siv-lengsavath"). Carried over from the ids
  -- in src/data/dentists.ts so seeding is idempotent and photo filenames line up.
  slug               text not null unique,
  full_name          text not null,
  -- "Practice Manager", "Front Office Coordinator". Null for dentists, whose
  -- title is already carried by the "Dr" in their name.
  title              text,
  -- Storage paths, not URLs. photo_circle_path is the pre-cropped circular PNG
  -- the PDF renderer embeds — the server has no canvas to crop with.
  photo_path         text,
  photo_circle_path  text,
  is_dentist         boolean not null default true,
  is_active          boolean not null default true,
  sort_order         smallint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint staff_members_full_name_not_blank check (length(btrim(full_name)) > 0),
  constraint staff_members_slug_format check (slug ~ '^[a-z][a-z0-9-]{1,60}$')
);

create trigger staff_members_set_updated_at
  before update on public.staff_members
  for each row execute function public.set_updated_at();

-- Many-to-many: Dr Siv Lengsavath works at both Burwood and Mulgrave.
create table public.staff_member_clinics (
  staff_member_id  uuid not null references public.staff_members (id) on delete cascade,
  clinic_id        uuid not null references public.clinics (id) on delete cascade,
  primary key (staff_member_id, clinic_id)
);

create index staff_member_clinics_clinic_idx on public.staff_member_clinics (clinic_id);

create table public.fee_items (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  description  text not null default '',
  fee          numeric(10, 2) not null default 0 check (fee >= 0),
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint fee_items_code_not_blank check (length(btrim(code)) > 0)
);

create trigger fee_items_set_updated_at
  before update on public.fee_items
  for each row execute function public.set_updated_at();

-- Uploaded artwork. Superseded rows are KEPT with is_active = false, so a bad
-- upload can be rolled back rather than being a one-way door.
create table public.templates (
  id            uuid primary key default gen_random_uuid(),
  kind          public.template_kind not null,
  -- 'team' pages belong to a clinic; the 'plan' template is shared.
  clinic_id     uuid references public.clinics (id) on delete cascade,
  storage_path  text not null,
  page_count    smallint,
  is_active     boolean not null default true,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint templates_clinic_matches_kind check (
    (kind = 'team' and clinic_id is not null)
    or
    (kind = 'plan' and clinic_id is null)
  )
);

-- At most one active template per slot. The coalesce gives the shared 'plan'
-- template a stable key, since a partial unique index ignores null clinic_id.
create unique index templates_one_active_per_slot
  on public.templates (kind, coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_active;

-- Text positions, font sizes and table metrics. A single shared row, where the
-- old app kept a per-browser copy in localStorage. Shape matches
-- TemplateSettings in src/types/index.ts.
create table public.template_settings (
  id          boolean primary key default true check (id),
  settings    jsonb not null,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Treatment plans — PATIENT DATA
-- -----------------------------------------------------------------------------

create table public.treatment_plans (
  id             uuid primary key default gen_random_uuid(),
  patient_name   text not null,
  plan_date      date not null default current_date,
  clinic_id      uuid not null references public.clinics (id),
  dentist_id     uuid references public.staff_members (id) on delete set null,
  -- Snapshot of the name as printed. A dentist can later be renamed or retired;
  -- what the patient was handed must not change retrospectively.
  dentist_name   text not null default '',
  total_amount   numeric(12, 2) not null default 0,
  status         public.plan_status not null default 'draft',
  created_by     uuid references public.profiles (id) on delete set null,
  updated_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Retention. Health records in Victoria generally must be kept for 7 years
  -- from last service (for a child, until they turn 25), so "delete" is a soft
  -- delete and the row is purged only once purge_after has passed.
  deleted_at     timestamptz,
  deleted_by     uuid references public.profiles (id) on delete set null,
  purge_after    date,
  constraint treatment_plans_patient_name_not_blank check (length(btrim(patient_name)) > 0)
);

create index treatment_plans_clinic_idx  on public.treatment_plans (clinic_id);
create index treatment_plans_created_idx on public.treatment_plans (created_at desc);
create index treatment_plans_live_idx    on public.treatment_plans (plan_date desc)
  where deleted_at is null;

create trigger treatment_plans_set_updated_at
  before update on public.treatment_plans
  for each row execute function public.set_updated_at();

-- Mirrors TreatmentItem in src/types/index.ts.
create table public.treatment_plan_items (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.treatment_plans (id) on delete cascade,
  phase        smallint not null default 1,
  visit_no     smallint not null default 1,
  item_code    text not null default '',
  times        smallint not null default 1,
  description  text not null default '',
  tooth        text not null default '',
  sort_order   integer not null default 0
);

create index treatment_plan_items_plan_idx on public.treatment_plan_items (plan_id, sort_order);

-- Mirrors FeeEntry: one item can carry several quantity x unit-fee lines.
create table public.treatment_plan_item_fees (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.treatment_plan_items (id) on delete cascade,
  quantity    numeric(6, 2) not null default 1,
  unit_fee    numeric(10, 2) not null default 0,
  sort_order  integer not null default 0
);

create index treatment_plan_item_fees_item_idx
  on public.treatment_plan_item_fees (item_id, sort_order);

-- -----------------------------------------------------------------------------
-- Activity log — PATIENT DATA
--
-- Records reads as well as writes: a privacy incident is usually someone
-- looking, and a write-only log would not see it. Because entries name
-- patients, this table carries the same retention and access rules as
-- treatment_plans. It is not a debug channel.
-- -----------------------------------------------------------------------------

create table public.activity_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  -- Snapshot, so history stays readable after an account is removed.
  actor_name   text not null default 'Unknown',
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  summary      text not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  purge_after  date,
  constraint activity_log_summary_not_blank check (length(btrim(summary)) > 0)
);

create index activity_log_created_idx on public.activity_log (created_at desc);
create index activity_log_actor_idx   on public.activity_log (actor_id, created_at desc);
create index activity_log_entity_idx  on public.activity_log (entity_type, entity_id);
