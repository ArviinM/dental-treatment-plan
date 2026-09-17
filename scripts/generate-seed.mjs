/**
 * Generates supabase/seed.sql from the constants the app currently ships with.
 *
 * The fee schedule is 168 rows and the dentist list is 14; retyping either into
 * SQL by hand would guarantee a typo and guarantee drift. This reads the real
 * TypeScript, so a seeded database matches what the app renders today.
 *
 *   node scripts/generate-seed.mjs
 *
 * One-way and one-time: once Phase 3 lands, the DATABASE is the source of truth
 * and these TypeScript files stop being authoritative. That is why every
 * generated statement is non-destructive — regenerating must never overwrite an
 * edit Ericka has made.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.join(import.meta.dirname, '..');

/** Transpiles a .ts module and imports it, so we read the real values. */
async function importTs(relativePath) {
  const source = await readFile(path.join(ROOT, relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });

  // Node cannot resolve the "@/..." path alias from a data: URL. None of the
  // values this script reads come through one — they are plain object literals —
  // so the aliased import and re-export lines are dropped rather than resolved.
  const standalone = outputText
    .split('\n')
    .filter((line) => !/^\s*(import|export)\b.*\bfrom\s+['"]@\//.test(line))
    .join('\n');

  return import(`data:text/javascript;base64,${Buffer.from(standalone).toString('base64')}`);
}

/** Single-quoted SQL literal. Null and undefined become NULL. */
function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replaceAll("'", "''")}'`;
}

const [{ LOCATIONS, DEFAULT_TEMPLATE_SETTINGS }, { DENTISTS }, { defaultFeeSchedule }] =
  await Promise.all([
    importTs('src/types/index.ts'),
    importTs('src/data/dentists.ts'),
    importTs('src/data/default-fee-schedule.ts'),
  ]);

const lines = [];
const say = (line = '') => lines.push(line);

say('-- =============================================================================');
say('-- GENERATED FILE — do not edit by hand.');
say('--   node scripts/generate-seed.mjs');
say('--');
say('-- Seeds the reference data the app currently hardcodes, so a fresh database');
say('-- behaves exactly like the version the team uses today.');
say('--');
say('-- Every statement is idempotent and NON-DESTRUCTIVE: re-running inserts what');
say('-- is missing and leaves existing rows alone. Once Ericka has edited a fee or a');
say('-- dentist, this file must never overwrite her.');
say('-- =============================================================================');
say();

// --- clinics ----------------------------------------------------------------
say('-- Clinics (from LOCATIONS in src/types/index.ts)');
say('insert into public.clinics (slug, name, website, phone, address, sort_order) values');
const clinicRows = Object.entries(LOCATIONS).map(
  ([slug, c], i) =>
    `  (${sql(slug)}, ${sql(c.name)}, ${sql(c.website)}, ${sql(c.phone)}, ${sql(c.address)}, ${i})`
);
say(`${clinicRows.join(',\n')}\non conflict (slug) do nothing;`);
say();

// --- staff ------------------------------------------------------------------
say('-- Dentists (from src/data/dentists.ts). Photos are migrated separately, so');
say('-- these rows carry no photo_path until the files are uploaded to storage.');
say('insert into public.staff_members (slug, full_name, is_dentist, sort_order) values');
const staffRows = DENTISTS.map((d, i) => `  (${sql(d.id)}, ${sql(d.name)}, true, ${i})`);
say(`${staffRows.join(',\n')}\non conflict (slug) do nothing;`);
say();

say('-- Which clinics each dentist works at (Dr Siv Lengsavath is at two).');
say('insert into public.staff_member_clinics (staff_member_id, clinic_id)');
say('select s.id, c.id');
say('  from public.staff_members s');
say('  join (values');
const pairs = DENTISTS.flatMap((d) =>
  d.locations.map((loc) => `    (${sql(d.id)}, ${sql(loc)})`)
);
say(pairs.join(',\n'));
say('  ) as v (staff_slug, clinic_slug) on v.staff_slug = s.slug');
say('  join public.clinics c on c.slug = v.clinic_slug');
say('on conflict do nothing;');
say();

// --- fee items --------------------------------------------------------------
say(`-- Fee schedule: ${defaultFeeSchedule.length} item codes`);
say('-- (from src/data/default-fee-schedule.ts)');
say('insert into public.fee_items (code, name, description, fee, sort_order) values');
const feeRows = defaultFeeSchedule.map(
  (f, i) => `  (${sql(f.code)}, ${sql(f.name)}, ${sql(f.description)}, ${sql(f.fee)}, ${i})`
);
say(`${feeRows.join(',\n')}\non conflict (code) do nothing;`);
say();

// --- template settings ------------------------------------------------------
say('-- Text positions and table metrics, copied verbatim from');
say('-- DEFAULT_TEMPLATE_SETTINGS so generated PDFs land identically.');
const settings = { ...DEFAULT_TEMPLATE_SETTINGS };
// Where the template FILES live is the templates table's job, not this blob's.
delete settings.coverPdf;
delete settings.treatmentPdf;
delete settings.teamPdfs;
say('insert into public.template_settings (id, settings) values');
say(`  (true, ${sql(JSON.stringify(settings, null, 2))}::jsonb)`);
say('on conflict (id) do nothing;');
say();

await mkdir(path.join(ROOT, 'supabase'), { recursive: true });
await writeFile(path.join(ROOT, 'supabase/seed.sql'), `${lines.join('\n')}\n`, 'utf8');

console.log(
  `seed.sql written: ${Object.keys(LOCATIONS).length} clinics, ` +
    `${DENTISTS.length} dentists, ${pairs.length} clinic links, ` +
    `${defaultFeeSchedule.length} fee items`
);
