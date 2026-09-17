import { requireAdmin } from '@/lib/auth';
import { getClinics, getStaffMembers } from '@/lib/data/reference';
import { StaffDirectory, type StaffRow } from '@/components/admin/StaffDirectory';

export const metadata = { title: 'Dentists | SIA Dental' };

export default async function StaffPage() {
  await requireAdmin();

  const [staff, clinics] = await Promise.all([
    getStaffMembers({ includeInactive: true }),
    getClinics(),
  ]);

  const rows: StaffRow[] = staff.map((person) => ({
    id: person.id,
    fullName: person.fullName,
    title: person.title,
    photoUrl: person.photoUrl,
    isDentist: person.isDentist,
    isActive: person.isActive,
    locations: person.locations,
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-sia-dark">Dentists</h1>
        <p className="mt-2 text-slate-500">
          Who appears in the dentist list when someone makes a treatment plan.
        </p>
      </header>

      <StaffDirectory staff={rows} clinics={clinics.map((c) => ({ slug: c.slug, name: c.name }))} />

      <p className="mt-10 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong className="font-semibold">A note on the team page.</strong> Changing this list does
        not change the team page at the back of a plan — that is a designed PDF with the photos
        built into the artwork. When the team changes, upload a new one under Templates.
      </p>
    </div>
  );
}
