import { PlanEditor } from '@/components/legacy/PlanEditor';
import { isAdmin, requireUser } from '@/lib/auth';
import {
  getFeeSchedule,
  getStaffMembers,
  getTemplateBackgrounds,
  getTemplateSettings,
} from '@/lib/data/reference';
import type { Dentist } from '@/data/dentists';

export const metadata = { title: 'Make a plan | SIA Dental' };

export default async function LegacyGeneratorPage() {
  const user = await requireUser();

  const [feeSchedule, staff, templateSettings, backgrounds] = await Promise.all([
    getFeeSchedule(),
    getStaffMembers(),
    getTemplateSettings(),
    getTemplateBackgrounds(),
  ]);

  // Mapped into the shape the frozen form already expects, rather than changing
  // the form to match the database. The screen does not change; its data source did.
  const dentists: Dentist[] = staff
    .filter((person) => person.isDentist)
    .map((person) => ({
      id: person.slug,
      name: person.fullName,
      photoUrl: person.photoUrl ?? '',
      locations: person.locations,
    }));

  return (
    <PlanEditor
      feeSchedule={feeSchedule}
      dentists={dentists}
      initialTemplateSettings={templateSettings}
      canSaveSettings={isAdmin(user.role)}
      backgrounds={backgrounds}
    />
  );
}
