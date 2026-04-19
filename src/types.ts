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

export const CAMPUS_PINS: Record<string, { role: 'admin' | 'tech', campusId?: string }> = {
  '7324': { role: 'admin' }, // The requested Admin PIN
  '8101': { role: 'tech', campusId: 'K8WES' },
  '8102': { role: 'tech', campusId: 'K8KAT' },
  '8103': { role: 'tech', campusId: 'K8RIC' },
  '8104': { role: 'tech', campusId: 'HSKAT' },
  '8105': { role: 'tech', campusId: 'K8PEA' },
  '8106': { role: 'tech', campusId: 'K8ORE' },
  '8107': { role: 'tech', campusId: 'K8WIN' },
  '8108': { role: 'tech', campusId: 'HSWIN' },
  '8109': { role: 'tech', campusId: 'K8COL' },
  '8110': { role: 'tech', campusId: 'HSAGG' },
  '8111': { role: 'tech', campusId: 'K8BGR' },
  '8112': { role: 'tech', campusId: 'K8MSG' },
  '8113': { role: 'tech', campusId: 'HSLIB' },
};

export const LOAN_REASONS = [
  'Lost Chromebook',
  'Forgotten at Home',
  'Broken',
  'Other',
];
