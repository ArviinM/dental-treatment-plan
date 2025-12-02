import type { FeeItem } from '@/types';

// Default fee schedule based on the images provided
// This can be imported from CSV or edited in settings
export const defaultFeeSchedule: FeeItem[] = [
  {
    code: '011',
    description: 'Comprehensive oral examination - A thorough evaluation of your teeth, gums, and oral tissues.',
    fee: 80,
  },
  {
    code: '012',
    description: 'Routine 6 Monthly Appointment - Prevention is better (and cheaper) than a cure! Your essential 6-monthly check-up includes oral cancer screening, thorough clean & polish, and X-rays if needed.',
    fee: 280,
  },
  {
    code: '114',
    description: 'Removal of calculus - Professional cleaning to remove tarite buildup.',
    fee: 120,
  },
  {
    code: '121',
    description: 'Topical fluoride treatment - Strengthening treatment for your teeth.',
    fee: 45,
  },
  {
    code: '311',
    description: 'Direct restoration - tooth coloured - One surface. A filling to repair a small area of decay.',
    fee: 180,
  },
  {
    code: '312',
    description: 'Direct restoration - tooth coloured - Two surfaces. A filling to repair a moderate area of decay.',
    fee: 250,
  },
  {
    code: '313',
    description: 'Direct restoration - tooth coloured - Three surfaces. A larger filling for more extensive decay.',
    fee: 320,
  },
  {
    code: '322',
    description: 'Tooth extraction - Removal of a tooth that cannot be saved.',
    fee: 220,
  },
  {
    code: '415',
    description: 'Root canal treatment - Front tooth. Treatment to save an infected tooth.',
    fee: 850,
  },
  {
    code: '416',
    description: 'Root canal treatment - Premolar. Treatment to save an infected tooth.',
    fee: 1050,
  },
  {
    code: '417',
    description: 'Root canal treatment - Molar. Treatment to save an infected tooth.',
    fee: 1350,
  },
  {
    code: '613',
    description: 'Crown - Looking for the most durability & protection for your tooth long term? A crown is the best option here, a solid cap tailor fitted to your existing tooth usually from porcelain, ceramic or metal.',
    fee: 1750,
  },
  {
    code: '615',
    description: 'Crown - Porcelain fused to metal. A durable crown with a natural appearance.',
    fee: 1650,
  },
  {
    code: '631',
    description: 'Dental implant - A permanent solution to replace a missing tooth.',
    fee: 4500,
  },
  {
    code: '711',
    description: 'Denture - Complete upper. A full set of replacement teeth for the upper jaw.',
    fee: 2200,
  },
  {
    code: '712',
    description: 'Denture - Complete lower. A full set of replacement teeth for the lower jaw.',
    fee: 2200,
  },
  {
    code: '821',
    description: 'Periodontal treatment - Deep cleaning below the gum line.',
    fee: 280,
  },
  {
    code: '926',
    description: 'Teeth whitening - Professional whitening treatment for a brighter smile.',
    fee: 650,
  },
];

