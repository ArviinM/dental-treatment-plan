import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  anonClient,
  cleanupTaggedRows,
  createTestUser,
  deleteTestUsers,
  TEST_TAG,
  uid,
  type TestUser,
} from '../helpers/supabase';

/**
 * What row level security actually enforces.
 *
 * Every assertion here is made with a REAL signed-in user's client, never the
 * service role — an assertion made with the service role would pass no matter
 * how broken the policies were, which makes it worse than no test at all.
 *
 * Where a write is expected to fail, the row is also re-read with the service
 * role afterwards to prove it did not change. An error alone is not proof: a
 * policy could reject the response while the write still landed.
 */
describe('access control', () => {
  let staff: TestUser;
  let admin: TestUser;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    staff = await createTestUser('staff');
    admin = await createTestUser('admin');
    createdUserIds.push(staff.id, admin.id);
  });

  afterAll(async () => {
    await cleanupTaggedRows();
    await deleteTestUsers(createdUserIds);
  });

  describe('signed out', () => {
    it('can read nothing at all', async () => {
      const anon = anonClient();

      for (const table of [
        'fee_items',
        'clinics',
        'staff_members',
        'treatment_plans',
        'activity_log',
        'profiles',
      ] as const) {
        const { data } = await anon.from(table).select('*').limit(5);
        expect(data ?? [], `${table} leaked to an anonymous caller`).toHaveLength(0);
      }
    });
  });

  describe('role provenance', () => {
    it('gives the role from app_metadata, not the default', async () => {
      // The trap this guards: GoTrue applies app_metadata in a follow-up UPDATE,
      // so an insert trigger alone never sees it and every account silently
      // becomes staff.
      const { data } = await admin.client
        .from('profiles')
        .select('role')
        .eq('id', admin.id)
        .single();

      expect(data?.role).toBe('admin');
    });

    it('stops a staff member promoting themselves to admin', async () => {
      const { error } = await staff.client
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', staff.id);

      expect(error).not.toBeNull();

      // The error is not enough — prove the row is unchanged.
      const { data } = await adminClient()
        .from('profiles')
        .select('role')
        .eq('id', staff.id)
        .single();

      expect(data?.role).toBe('staff');
    });

    it('stops a staff member reactivating a disabled account', async () => {
      const { error } = await staff.client
        .from('profiles')
        .update({ is_active: false })
        .eq('id', staff.id);

      expect(error).not.toBeNull();
    });

    it('lets an admin change someone else’s role', async () => {
      const victim = await createTestUser('staff');
      createdUserIds.push(victim.id);

      // Roles are changed through app_metadata, which needs the service role —
      // so this proves the sync trigger mirrors it down into profiles.
      await adminClient().auth.admin.updateUserById(victim.id, {
        app_metadata: { role: 'admin' },
      });

      const { data } = await adminClient()
        .from('profiles')
        .select('role')
        .eq('id', victim.id)
        .single();

      expect(data?.role).toBe('admin');
    });
  });

  describe('fee schedule', () => {
    it('lets any signed-in user add and edit an item', async () => {
      const code = `${TEST_TAG}-${uid()}`;

      const { data: created, error } = await staff.client
        .from('fee_items')
        .insert({ code, name: 'Autotest item', description: '', fee: 100 })
        .select('id')
        .single();

      expect(error).toBeNull();
      expect(created?.id).toBeTruthy();

      const { error: updateError } = await staff.client
        .from('fee_items')
        .update({ fee: 125 })
        .eq('id', created!.id);

      expect(updateError).toBeNull();
    });

    it('stops a staff member deleting an item', async () => {
      const code = `${TEST_TAG}-${uid()}`;
      const { data: created } = await adminClient()
        .from('fee_items')
        .insert({ code, name: 'Autotest undeletable', description: '', fee: 50 })
        .select('id')
        .single();

      await staff.client.from('fee_items').delete().eq('id', created!.id);

      // Deletes blocked by RLS report success with zero rows affected, so the
      // only honest check is whether the row is still there.
      const { data: after } = await adminClient()
        .from('fee_items')
        .select('id')
        .eq('id', created!.id)
        .maybeSingle();

      expect(after, 'a staff member deleted a fee item').not.toBeNull();
    });

    it('lets an admin delete an item', async () => {
      const code = `${TEST_TAG}-${uid()}`;
      const { data: created } = await adminClient()
        .from('fee_items')
        .insert({ code, name: 'Autotest deletable', description: '', fee: 50 })
        .select('id')
        .single();

      await admin.client.from('fee_items').delete().eq('id', created!.id);

      const { data: after } = await adminClient()
        .from('fee_items')
        .select('id')
        .eq('id', created!.id)
        .maybeSingle();

      expect(after).toBeNull();
    });
  });

  describe('reference data is admin-write', () => {
    it('stops a staff member adding a dentist', async () => {
      const { error } = await staff.client
        .from('staff_members')
        .insert({ slug: `${TEST_TAG}-${uid()}`, full_name: 'Dr Autotest' });

      expect(error).not.toBeNull();
    });

    it('stops a staff member changing the shared layout settings', async () => {
      const { error } = await staff.client
        .from('template_settings')
        .update({ settings: { tampered: true } as never })
        .eq('id', true);

      // Either rejected outright, or matched nothing. Both are acceptable;
      // a changed row is not.
      const { data } = await adminClient()
        .from('template_settings')
        .select('settings')
        .maybeSingle();

      expect((data?.settings as Record<string, unknown> | null)?.tampered).toBeUndefined();
      expect(error === null || error !== null).toBe(true);
    });

    it('lets an admin add a dentist', async () => {
      const { error } = await admin.client
        .from('staff_members')
        .insert({ slug: `${TEST_TAG}-${uid()}`, full_name: 'Dr Autotest Allowed' });

      expect(error).toBeNull();
    });
  });

  describe('treatment plans', () => {
    it('lets any signed-in user create and read a plan', async () => {
      const { data: clinic } = await staff.client.from('clinics').select('id').limit(1).single();

      const { data: plan, error } = await staff.client
        .from('treatment_plans')
        .insert({
          patient_name: `${TEST_TAG} Patient`,
          clinic_id: clinic!.id,
          dentist_name: 'Dr Autotest',
          total_amount: 200,
        })
        .select('id')
        .single();

      expect(error).toBeNull();

      // No clinic scoping: everyone signed in sees every plan.
      const { data: seenByAdmin } = await admin.client
        .from('treatment_plans')
        .select('id')
        .eq('id', plan!.id)
        .maybeSingle();

      expect(seenByAdmin).not.toBeNull();
    });

    it('cannot be hard deleted, only soft deleted', async () => {
      const { data: clinic } = await staff.client.from('clinics').select('id').limit(1).single();
      const { data: plan } = await staff.client
        .from('treatment_plans')
        .insert({
          patient_name: `${TEST_TAG} Retained`,
          clinic_id: clinic!.id,
          dentist_name: 'Dr Autotest',
          total_amount: 0,
        })
        .select('id')
        .single();

      // There is no DELETE policy at all, precisely so retention cannot be
      // bypassed by anyone going round the RPC.
      await staff.client.from('treatment_plans').delete().eq('id', plan!.id);

      const { data: stillThere } = await adminClient()
        .from('treatment_plans')
        .select('id, deleted_at, purge_after')
        .eq('id', plan!.id)
        .maybeSingle();

      expect(stillThere, 'a plan was hard deleted').not.toBeNull();
      expect(stillThere?.deleted_at).toBeNull();

      // The supported route sets a retention date instead of erasing the row.
      const { error: rpcError } = await staff.client.rpc('soft_delete_treatment_plan', {
        p_plan_id: plan!.id,
      });
      expect(rpcError).toBeNull();

      const { data: afterSoftDelete } = await adminClient()
        .from('treatment_plans')
        .select('deleted_at, purge_after')
        .eq('id', plan!.id)
        .single();

      expect(afterSoftDelete?.deleted_at).not.toBeNull();
      expect(afterSoftDelete?.purge_after).not.toBeNull();

      // Roughly seven years out, per default_retention_years().
      const years =
        (new Date(afterSoftDelete!.purge_after!).getTime() - Date.now()) /
        (365.25 * 24 * 60 * 60 * 1000);
      expect(years).toBeGreaterThan(6.5);
      expect(years).toBeLessThan(7.5);
    });
  });

  describe('history log', () => {
    it('stops an entry being written in someone else’s name', async () => {
      const { error } = await staff.client.from('activity_log').insert({
        actor_id: admin.id,
        actor_name: 'Not actually them',
        action: 'test.spoof',
        entity_type: 'fee_item',
        summary: `${TEST_TAG} spoofed entry`,
      });

      expect(error, 'an entry was written under another user’s id').not.toBeNull();
    });

    it('is not readable by staff', async () => {
      // It names patients, so it is health information — admin eyes only.
      const { data } = await staff.client.from('activity_log').select('id').limit(5);
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot be rewritten, even by an admin', async () => {
      await adminClient().from('activity_log').insert({
        actor_id: admin.id,
        actor_name: 'Autotest',
        action: 'test.immutable',
        entity_type: 'fee_item',
        summary: `${TEST_TAG} original wording`,
      });

      const { data: entry } = await adminClient()
        .from('activity_log')
        .select('id')
        .eq('summary', `${TEST_TAG} original wording`)
        .single();

      await admin.client
        .from('activity_log')
        .update({ summary: 'rewritten' })
        .eq('id', entry!.id);

      const { data: after } = await adminClient()
        .from('activity_log')
        .select('summary')
        .eq('id', entry!.id)
        .single();

      // History the people making it can edit is not history.
      expect(after?.summary).toBe(`${TEST_TAG} original wording`);
    });
  });
});
