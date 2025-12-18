import type { Location } from '@/types';

export interface Dentist {
  id: string;
  name: string;
  photoUrl: string;
  locations: Location[];
}

export const DENTISTS: Dentist[] = [
  // Burwood & Mulgrave
  {
    id: 'dr-siv-lengsavath',
    name: 'Dr Siv Lengsavath',
    photoUrl: '/dentist-photos/dr-siv-lengsavath.jpg',
    locations: ['burwood', 'mulgrave'],
  },
  {
    id: 'dr-adina-low',
    name: 'Dr Adina Low',
    photoUrl: '/dentist-photos/dr-adina-low.png',
    locations: ['burwood', 'mulgrave'],
  },
  {
    id: 'dr-esther-chin',
    name: 'Dr Esther Chin',
    photoUrl: '/dentist-photos/dr-esther-chin.png',
    locations: ['burwood'],
  },
  {
    id: 'dr-jessy-youn',
    name: 'Dr Jessy Youn',
    photoUrl: '/dentist-photos/dr-jessy-youn.jpg',
    locations: ['burwood'],
  },
  {
    id: 'dr-kimberlyn-ong',
    name: 'Dr Kimberlyn Ong',
    photoUrl: '/dentist-photos/dr-kimberlyn-ong.png',
    locations: ['burwood', 'mulgrave'],
  },
  {
    id: 'dr-won-noh',
    name: 'Dr Won Noh',
    photoUrl: '/dentist-photos/dr-won-noh.png',
    locations: ['burwood'],
  },
  {
    id: 'dr-brenda-morris',
    name: 'Dr Brenda Morris',
    photoUrl: '/dentist-photos/dr-brenda-morris.png',
    locations: ['mulgrave'],
  },

  // Essendon
  {
    id: 'dr-claire-tan',
    name: 'Dr Claire Tan',
    photoUrl: '/dentist-photos/dr-claire-tan.jpg',
    locations: ['essendon'],
  },
  {
    id: 'dr-dan-trinh',
    name: 'Dr Dan Trinh',
    photoUrl: '/dentist-photos/dr-dan-trinh.jpg',
    locations: ['essendon'],
  },
  {
    id: 'dr-edmund-kwong',
    name: 'Dr Edmund Kwong',
    photoUrl: '/dentist-photos/dr-edmund-kwong.jpg',
    locations: ['essendon'],
  },
  {
    id: 'dr-kelly-sin',
    name: 'Dr Kelly Sin',
    photoUrl: '/dentist-photos/dr-kelly-sin.png',
    locations: ['essendon'],
  },
  {
    id: 'dr-rama-chockalingam',
    name: 'Dr Rama Chockalingam',
    photoUrl: '/dentist-photos/dr-rama-chockalingam.jpg',
    locations: ['essendon'],
  },
  {
    id: 'dr-yeseul-baek',
    name: 'Dr Yeseul Baek',
    photoUrl: '/dentist-photos/dr-yeseul-baek.jpg',
    locations: ['essendon'],
  },
  {
    id: 'dr-david-liu',
    name: 'Dr David Liu',
    photoUrl: '/dentist-photos/dr-david-liu.jpg',
    locations: ['essendon'],
  },
];

export const getDentistByName = (name: string): Dentist | undefined => {
  const normalizedSearch = name.toLowerCase().replace(/dr\.?\s*/i, '').trim();
  return DENTISTS.find(d => {
    const normalizedName = d.name.toLowerCase().replace(/dr\.?\s*/i, '').trim();
    return normalizedName === normalizedSearch || d.name.toLowerCase().includes(normalizedSearch);
  });
};
