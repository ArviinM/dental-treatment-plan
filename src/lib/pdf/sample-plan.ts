import type { Location, TreatmentPlanData } from '@/types';

/**
 * A stand-in plan, for checking artwork and positions before real patients see
 * them. Used by the positioning preview and by the sample PDF of a draft
 * template, so both show the same thing.
 *
 * Deliberately awkward rather than "John Smith": a long hyphenated name with an
 * apostrophe is what overflows the name box, and two visits across two phases
 * is what draws the subtotal rows — the parts most likely to collide with
 * artwork. If it looks right on this it will look right in practice.
 */
export function samplePlan(location: Location = 'burwood'): TreatmentPlanData {
  return {
    patientName: 'Jonathan Santos-O’Brien',
    doctorName: 'Dr Siv Lengsavath',
    date: new Date().toISOString().split('T')[0],
    location,
    totalAmount: 559,
    items: [
      {
        id: 's1',
        phase: 1,
        visitNo: 1,
        itemCode: '011',
        times: 1,
        description: 'Comprehensive examination of your teeth, gums and mouth.',
        tooth: '—',
        fees: [{ id: 'f1', quantity: 1, unitFee: 84 }],
      },
      {
        id: 's2',
        phase: 1,
        visitNo: 1,
        itemCode: '114',
        times: 1,
        description: 'Removal of calculus, first visit.',
        tooth: '—',
        fees: [{ id: 'f2', quantity: 1, unitFee: 150 }],
      },
      {
        id: 's3',
        phase: 2,
        visitNo: 1,
        itemCode: '532',
        times: 1,
        description: 'Tooth-coloured restoration, three surfaces.',
        tooth: '36',
        fees: [{ id: 'f3', quantity: 1, unitFee: 325 }],
      },
    ],
  };
}
