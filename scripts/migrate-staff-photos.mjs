/**
 * Moves the dentist photos out of the repo and into Supabase Storage.
 *
 *   node scripts/migrate-staff-photos.mjs           # dry run, shows the plan
 *   node scripts/migrate-staff-photos.mjs --apply   # actually upload
 *
 * seed.sql created the 14 dentists but left photo_path null, because SQL cannot
 * carry binary files. This is the other half of that migration.
 *
 * Only `photo_path` is set, not `photo_circle_path`. The circular version is an
 * optimisation, not a requirement: the UI clips the photo with CSS, and the
 * browser crops it to a circle before posting it to the PDF renderer. When
 * Ericka replaces a photo through /admin/staff both paths get written, and the
 * renderer prefers the circle when it exists.
 *
 * Safe to re-run: it skips anyone who already has a photo, so it will never
 * overwrite something uploaded through the app.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const ROOT = path.join(import.meta.dirname, '..');
const PHOTO_DIR = path.join(ROOT, 'public/dentist-photos');
const BUCKET = 'staff-photos';

const apply = process.argv.includes('--apply');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run through ./scripts/with-env.sh`);
  return value;
}

const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

const admin = createClient(
  required('NEXT_PUBLIC_SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } }
);

// Only the kebab-case files at the top level are the ones the app referenced;
// the per-clinic subfolders hold unused originals.
const files = (await readdir(PHOTO_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^dr-.+\.(jpg|jpeg|png)$/i.test(entry.name))
  .map((entry) => entry.name);

const { data: staff, error } = await admin
  .from('staff_members')
  .select('id, slug, full_name, photo_path')
  .order('sort_order');

if (error) throw new Error(`could not read staff_members: ${error.message}`);

console.log(`${staff.length} dentists in the database, ${files.length} photo files on disk`);
console.log(apply ? 'APPLYING\n' : 'DRY RUN — pass --apply to upload\n');

let uploaded = 0;
let skipped = 0;
const unmatched = [];

for (const person of staff) {
  if (person.photo_path) {
    console.log(`  skip    ${person.full_name} — already has a photo`);
    skipped++;
    continue;
  }

  // The seed used the same slugs as the original filenames, so this lines up.
  const file = files.find((name) => path.parse(name).name.toLowerCase() === person.slug);

  if (!file) {
    console.log(`  MISSING ${person.full_name} (${person.slug}) — no matching file`);
    unmatched.push(person.full_name);
    continue;
  }

  const ext = path.extname(file).toLowerCase();
  const storagePath = `${person.slug}/original${ext}`;

  if (!apply) {
    console.log(`  would   ${person.full_name} -> ${storagePath}`);
    uploaded++;
    continue;
  }

  const bytes = await readFile(path.join(PHOTO_DIR, file));
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: CONTENT_TYPES[ext], upsert: true });

  if (uploadError) {
    console.log(`  FAILED  ${person.full_name}: ${uploadError.message}`);
    continue;
  }

  const { error: updateError } = await admin
    .from('staff_members')
    .update({ photo_path: storagePath })
    .eq('id', person.id);

  if (updateError) {
    console.log(`  FAILED  ${person.full_name}: ${updateError.message}`);
    continue;
  }

  console.log(`  ok      ${person.full_name} -> ${storagePath}`);
  uploaded++;
}

console.log();
console.log(`${apply ? 'uploaded' : 'would upload'}: ${uploaded}, skipped: ${skipped}`);
if (unmatched.length) console.log(`no photo file for: ${unmatched.join(', ')}`);
