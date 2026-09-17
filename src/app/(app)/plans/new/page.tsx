import { requireUser } from '@/lib/auth';
import { getClinics, getFeeSchedule, getStaffMembers, getTemplateSettings } from '@/lib/data/reference';
import { PlanBuilder } from '@/components/plans/PlanBuilder';
import type { Dentist } from '@/data/dentists';

export const metadata = { title: 'New plan | SIA Dental' };

export default async function NewPlanPage() {
  await requireUser();

  const [feeSchedule, staff, clinics, templateSettings] = await Promise.all([
    getFeeSchedule(),
    getStaffMembers(),
    getClinics(),
    getTemplateSettings(),
  ]);

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
    />
  );
}
