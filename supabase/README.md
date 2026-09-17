# Database

Real migrations, applied by the Supabase CLI — not SQL pasted into the dashboard one statement at a time. Every change to the schema is a new file here, so the database can be rebuilt from scratch and reviewed in a diff.

> **Applied on 2026-09-17** to the `SIA Dental` project (`ap-southeast-2`, Sydney). All 8 migrations are live and the reference data is seeded. `supabase db advisors` reports 12 warnings and zero errors; the remainder are intentional or negligible, and are triaged at the bottom of this file.

## Files, in apply order

| File | What it does |
|---|---|
| `..._init_schema.sql` | Enums, 11 tables, `updated_at` triggers, indexes |
| `..._functions.sql` | `auth_role()`, `is_admin()`, `is_active_user()` — the helpers RLS is built on |
| `..._rls_policies.sql` | Enables RLS everywhere, then 33 policies |
| `..._privilege_guard.sql` | Stops a staff member editing their own role |
| `..._auth_triggers.sql` | Keeps `profiles` in step with `auth.users` |
| `..._storage.sql` | `staff-photos` (public) and `plan-templates` (private) buckets |
| `..._retention.sql` | Soft delete, retention dates, and the purge function |
| `..._advisor_fixes.sql` | Pins `search_path`, un-publishes the trigger RPCs, hoists `auth.uid()` |

`seed.sql` is **generated** — `yarn db:seed:generate` rebuilds it from `src/data/*` and `src/types/index.ts`. Do not edit it by hand. It seeds 3 clinics, 14 dentists, 168 fee items and the template settings, and every statement is `on conflict do nothing`, so it can never overwrite an edit Ericka has made.

## Running it when the credentials arrive

```bash
export SUPABASE_PROJECT_REF=...     # from the project's dashboard URL
npx supabase login
yarn db:link
yarn db:push                        # applies every migration in order
yarn db:types                       # regenerates src/lib/database.types.ts
```

Create the project in **`ap-southeast-2` (Sydney)**. That is both a latency decision — the clinics are in Melbourne — and a data-location one, because the plans hold health information.

`seed.sql` is not run by `db:push`. Apply it once, deliberately, against the new project:

```bash
yarn db:seed     # supabase db query --linked --file supabase/seed.sql
```

## Two things to get right

**Role comes from `app_metadata`, never `user_metadata`.** A signed-in user can write their own `user_metadata`; only the service-role key can write `app_metadata`. `handle_new_user()` reads the role from `app_metadata` for exactly that reason.

There is a second trigger, `sync_profile_from_app_metadata()`, because GoTrue's `admin.createUser` inserts the user first and applies `app_metadata` in a *follow-up update*. Without it, the insert trigger never sees the role and every account — including Ericka's — is silently created as `staff`.

**Patient data has a retention clock.** `treatment_plans` and `activity_log` hold health information about identifiable people. Deleting a plan calls `soft_delete_treatment_plan()`, which hides it and sets `purge_after`; only `purge_expired_records()` erases anything, and only once that date has passed. The default is 7 years, set in `default_retention_years()`.

That period is a sensible default, **not legal advice** — confirm it with whoever advises the practice before it runs against real records. `purge_expired_records()` also still needs scheduling, via `pg_cron` or a protected route on a Vercel cron.

## Local development

`supabase start` runs the whole stack in Docker. Useful, but heavy on disk — ask before starting it on Arvin's machine.

## Remaining advisor warnings

`yarn db:lint` and `supabase db advisors --linked` still report 12 warnings. All
were reviewed and left deliberately:

- **7 x `multiple_permissive_policies`** — each reference table has a broad
  `select` policy plus an admin `for all` policy, so both are evaluated on a
  read. Removing the overlap means replacing one clean `for all` with three
  separate insert/update/delete policies. On tables holding 3 to 168 rows that
  trade is not worth the extra surface to get wrong.
- **4 x `authenticated_security_definer_function_executable`** — `auth_role()`,
  `is_admin()`, `is_active_user()` and `soft_delete_treatment_plan()` are
  *supposed* to be callable by signed-in users. The grants are deliberate.
- **1 x `extension_in_public`** — `citext` sits in `public`. Moving an extension
  that a live column type depends on is risky for very little gain.

Re-check with `supabase db advisors --linked` after any schema change, and treat
a new **ERROR** as a blocker.
