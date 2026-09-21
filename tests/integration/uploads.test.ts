import { readFile } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUsers,
  TEST_TAG,
  uid,
  type TestUser,
} from '../helpers/supabase';

/**
 * Uploads, at the sizes real files actually are.
 *
 * REGRESSION: template uploads broke in production. The PDF was sent through a
 * server action, which rejects bodies over 1 MB, and a fresh Canva export of a
 * team page is 2-5 MB. It went unnoticed because the storage test before this
 * one used the 394 KB compressed file that ships in the repo — a size nobody
 * would ever upload.
 *
 * So these use the real originals. If this suite ever passes with a small file
 * and fails with a big one, it has done its job.
 */

const TEMPLATE_BUCKET = 'plan-templates';
const PHOTO_BUCKET = 'staff-photos';

describe('uploads at real-world sizes', () => {
  let admin: TestUser;
  let staff: TestUser;
  const createdUsers: string[] = [];
  const createdTemplatePaths: string[] = [];
  const createdPhotoPaths: string[] = [];

  beforeAll(async () => {
    admin = await createTestUser('admin');
    staff = await createTestUser('staff');
    createdUsers.push(admin.id, staff.id);
  });

  afterAll(async () => {
    const service = adminClient();
    if (createdTemplatePaths.length) {
      await service.storage.from(TEMPLATE_BUCKET).remove(createdTemplatePaths);
    }
    if (createdPhotoPaths.length) {
      await service.storage.from(PHOTO_BUCKET).remove(createdPhotoPaths);
    }
    await deleteTestUsers(createdUsers);
  });

  it('accepts a 4.8 MB team page — the size that broke in production', async () => {
    const pdf = await readFile('public/templates/originals/mulgrave-team.pdf');

    // Guard the guard: if someone swaps in a smaller fixture, this test would
    // pass while proving nothing.
    expect(pdf.length, 'fixture must be over the 1 MB server-action limit').toBeGreaterThan(
      1024 * 1024
    );

    const path = `team/${TEST_TAG}-${uid()}/upload.pdf`;
    createdTemplatePaths.push(path);

    // Step 1 as the app does it: the admin's OWN client asks for the URL, so the
    // bucket's upload policy is what decides.
    const { data: signed, error: signError } = await admin.client.storage
      .from(TEMPLATE_BUCKET)
      .createSignedUploadUrl(path);

    expect(signError).toBeNull();
    expect(signed?.token).toBeTruthy();

    // Step 2: straight to storage, never through a function.
    const { error: uploadError } = await anonClient()
      .storage.from(TEMPLATE_BUCKET)
      .uploadToSignedUrl(signed!.path, signed!.token, pdf, { contentType: 'application/pdf' });

    expect(uploadError, uploadError?.message).toBeNull();

    // And it arrives intact.
    const { data: blob } = await adminClient().storage.from(TEMPLATE_BUCKET).download(path);
    const bytes = Buffer.from(await blob!.arrayBuffer());
    expect(bytes.length).toBe(pdf.length);
    expect(Buffer.compare(bytes, pdf)).toBe(0);
  });

  it('refuses a template upload URL to a staff member', async () => {
    const { data, error } = await staff.client.storage
      .from(TEMPLATE_BUCKET)
      .createSignedUploadUrl(`team/${TEST_TAG}-${uid()}/nope.pdf`);

    expect(data?.token, 'staff were issued a template upload URL').toBeFalsy();
    expect(error).not.toBeNull();
  });

  it('refuses a template upload URL to someone signed out', async () => {
    const { data, error } = await anonClient()
      .storage.from(TEMPLATE_BUCKET)
      .createSignedUploadUrl(`team/${TEST_TAG}-${uid()}/nope.pdf`);

    expect(data?.token).toBeFalsy();
    expect(error).not.toBeNull();
  });

  it('accepts a staff photo over 1 MB, which is most phone photos', async () => {
    // Pad a real photo past 1 MB. Trailing bytes after a JPEG's end marker are
    // ignored by decoders, so this is still a valid image of a realistic size.
    const photo = await readFile('public/dentist-photos/dr-adina-low.png');
    const padded = Buffer.concat([photo, Buffer.alloc(1_200_000)]);
    expect(padded.length).toBeGreaterThan(1024 * 1024);

    const path = `${TEST_TAG}-${uid()}/original.png`;
    createdPhotoPaths.push(path);

    const { data: signed, error: signError } = await admin.client.storage
      .from(PHOTO_BUCKET)
      .createSignedUploadUrl(path);

    expect(signError).toBeNull();

    const { error: uploadError } = await anonClient()
      .storage.from(PHOTO_BUCKET)
      .uploadToSignedUrl(signed!.path, signed!.token, padded, { contentType: 'image/png' });

    expect(uploadError, uploadError?.message).toBeNull();
  });

  it('still enforces the bucket size limit on a direct upload', async () => {
    // Uploading straight to storage skips our server, so the BUCKET has to be
    // what stops an oversized file. Prove it does.
    const tooBig = Buffer.alloc(6 * 1024 * 1024);
    const path = `${TEST_TAG}-${uid()}/too-big.png`;
    createdPhotoPaths.push(path);

    const { data: signed } = await admin.client.storage
      .from(PHOTO_BUCKET)
      .createSignedUploadUrl(path);

    const { error } = await anonClient()
      .storage.from(PHOTO_BUCKET)
      .uploadToSignedUrl(signed!.path, signed!.token, tooBig, { contentType: 'image/png' });

    expect(error, 'a 6 MB photo got past the 5 MB bucket limit').not.toBeNull();
  });
});
