# 🦷 SIA Dental — Treatment Plans

Treatment plan PDFs for **SIA Dental**, three clinics in Melbourne: Essendon, Burwood and Mulgrave.

Someone fills in a patient's details and their treatments, and the app produces the branded PDF the patient is handed. It is used in real appointments.

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

---

## Two ways to make a plan, on purpose

| | |
|---|---|
| **`/legacy`** — *Classic builder* | The original screen, frozen. Same layout, same tabs, same buttons. It is not going anywhere. |
| **`/plans/new`** — *Make a plan* | Newer and quicker: search treatments by name, group them into visits, and it saves as you go. |

Both render through the same engine, so the PDF is identical whichever screen produced it.

The classic builder is kept deliberately. The team has habits built on it, and a tool that changes underneath people mid-appointment is a worse tool. They move across when they want to.

## What it does

- **Plans** — patient, dentist, clinic, treatments grouped by phase and visit, with fees that total themselves
- **Live preview** — a canvas that redraws as you type, showing exactly what will download
- **PDF generation** — server-side, overlaying content onto the designed Canva artwork
- **Import** — read an existing treatment plan PDF back in
- **Fee schedule** — one shared price list, editable by the whole team
- **Dentists** — add, edit and retire dentists and their photos, no deploy needed
- **Templates** — replace the plan and team page artwork, with version history and one-click restore
- **Text positioning** — nudge where the name, dentist, photo and table sit, with a live preview
- **Accounts** — admin creates them and hands over a temporary password
- **History** — who changed what, and who opened which plan

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · [pdf-lib](https://pdf-lib.js.org/) · Supabase (Postgres, Auth, Storage) · Vercel

Both Vercel functions and the Supabase project run in **Sydney** — the clinics are in Melbourne, and a US region would cross the Pacific twice for every query.

## Running it

```bash
yarn                      # install
cp .env.example .env.local  # then fill it in from the Supabase dashboard
yarn dev                  # http://localhost:3000
```

You will need an account to get past the login. The first one is minted outside the app, because only an admin can create an admin:

```bash
./scripts/create-admin.sh "Your Name" you@example.com
```

It prints a temporary password once and forces a change at first sign-in. Everyone after that is created from **/admin/accounts**.

### Database

Real migrations, applied with the Supabase CLI — not SQL pasted into the dashboard.

```bash
yarn db:link     # needs SUPABASE_PROJECT_REF
yarn db:push     # apply migrations
yarn db:seed     # clinics, dentists, 168 fee items
yarn db:types    # regenerate src/lib/database.types.ts
```

Then upload the dentist photos, which SQL cannot carry:

```bash
./scripts/with-env.sh node scripts/migrate-staff-photos.mjs --apply
```

See [`supabase/README.md`](supabase/README.md) for the schema and the traps worth knowing.

### Tests

```bash
yarn test              # unit — fast and safe
yarn test:integration  # ⚠️ runs against the REAL database
```

The integration suite proves what row level security actually enforces — that a staff member cannot promote themselves, cannot delete a fee item, cannot write history under someone else's name. Every assertion is made with a real signed-in user's client, never the service role: a service-role assertion passes no matter how broken the policies are.

Fixtures are tagged `zz-autotest` and cleaned up, and nothing deletes a row it did not create. Do not run it once real patient records exist.

## Patient data

Saved plans hold patient names and treatments, which is health information about identifiable people. In Victoria that means the **Privacy Act 1988 (Cth)** and the **Health Records Act 2001 (Vic)** — not HIPAA, which is US law. The Privacy Act's small-business exemption does not cover health service providers.

What follows from that, and is built in:

- Data lives in Sydney
- Row level security on every table, and reads are logged as well as writes
- Deleting a plan is a soft delete with a retention date; a nightly job erases rows only once that date has passed, and records every run
- No patient name reaches a URL, a function log or any third-party tool

The 7-year default in `default_retention_years()` is a sensible starting point, not legal advice.

## Notes

- **Page size is 810 × 1440 pt** (11.25 × 20 in) — matches the Canva artwork, deliberately not A4
- **PDF coordinates start bottom-left**; the canvas preview starts top-left and converts
- **Measurements live in `src/lib/pdf/layout.ts`**, shared by the renderer and the preview so they cannot drift
- Brand: SIA Teal `#2BBFB3`, SIA Purple `#A5338D`, Dark Gray `#1F2937`, Nunito throughout

---

Built for SIA Dental.
