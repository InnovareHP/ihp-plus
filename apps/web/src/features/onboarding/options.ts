// Seeded as constants because no admin surface exists to curate lookup tables yet.
export const DEPARTMENTS = [
  'Care Management',
  'Clinical Operations',
  'Provider Network',
  'Member Services',
  'Revenue Cycle',
  'Quality & Compliance',
  'Information Technology',
  'Finance',
  'People & Culture',
  'Executive',
] as const

export const POSITIONS = [
  'Care Coordinator',
  'Case Manager',
  'Registered Nurse',
  'Nurse Practitioner',
  'Physician',
  'Medical Assistant',
  'Billing Specialist',
  'Compliance Analyst',
  'Data Analyst',
  'Software Engineer',
  'Operations Manager',
  'Director',
  'Vice President',
] as const

export const EMPLOYMENT_TYPES = [
  'Full-time',
  'Part-time',
  'Contract',
  'Per diem',
  'Intern',
] as const

export type Department = (typeof DEPARTMENTS)[number]
export type Position = (typeof POSITIONS)[number]
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]
