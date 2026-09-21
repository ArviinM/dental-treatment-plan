import { notFound } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { getPlan } from '@/lib/plans/mutations';
import { getClinics, getFeeSchedule, getStaffMembers, getTemplateBackgrounds, getTemplateSettings } from '@/lib/data/reference';
import { PlanBuilder } from '@/components/plans/PlanBuilder';
import type { Dentist } from '@/data/dentists';

export const metadata = { title: 'Treatment plan | SIA Dental' };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  // getPlan records that this plan was OPENED, not just changed. A privacy
  // incident is usually someone reading, and a write-only log never sees it.
  const [plan, feeSchedule, staff, clinics, templateSettings, backgrounds] = await Promise.all([
    getPlan(id),
    getFeeSchedule(),
    getStaffMembers(),
    getClinics(),
    getTemplateSettings(),
    getTemplateBackgrounds(),
  ]);

  if (!plan) notFound();

  const dentists: Dentist[] = staff
    .filter((person) => person.isDentist)
    .map((person) => ({
      // The real row id, not the slug: PlanBuilder stores this as dentist_id,
      // which is a foreign key into staff_members.
      id: person.id,
      name: person.fullName,
      photoUrl: person.photoUrl ?? '',
      locations: person.locations,
    }));

  return (
    <PlanBuilder
      feeSchedule={feeSchedule}
      dentists={dentists}
      clinics={clinics.map((c) => ({ slug: c.slug, name: c.name }))}
      templateSettings={templateSettings}
      backgrounds={backgrounds}
      existing={plan}
    />
  );
}
