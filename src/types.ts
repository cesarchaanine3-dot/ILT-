export interface Student {
  id: string; // This is the ID number from the school
  name: string;
  grade: string;
  email: string;
  location: string;
  campusId: string;
}

export interface LoanRecord {
  id: string;
  studentId: string;
  studentName: string;
  assetTag?: string; // Chromebooks have asset tags
  type: 'chromebook' | 'charger';
  reason?: string; // Lost, Forgotten, Broken (for chromebooks)
  checkoutDate: string;
  returnDate: string | null;
  status: 'active' | 'returned';
  campusId: string;
}

export const CAMPUSES = [
  { id: 'K8WES', name: 'K8WES' },
  { id: 'K8KAT', name: 'K8KAT' },
  { id: 'K8RIC', name: 'K8RIC' },
  { id: 'HSKAT', name: 'HSKAT' },
  { id: 'K8PEA', name: 'K8PEA' },
  { id: 'K8ORE', name: 'K8ORE' },
  { id: 'K8WIN', name: 'K8WIN' },
  { id: 'HSWIN', name: 'HSWIN' },
  { id: 'K8COL', name: 'K8COL' },
  { id: 'HSAGG', name: 'HSAGG' },
  { id: 'K8BGR', name: 'K8BGR' },
  { id: 'K8MSG', name: 'K8MSG' },
  { id: 'HSLIB', name: 'HSLIB' },
];

export const LOAN_REASONS = [
  'Lost Chromebook',
  'Forgotten at Home',
  'Broken',
  'Other',
];
