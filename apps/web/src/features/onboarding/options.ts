// Departments are not here: they are teams in the organization, seeded by `pnpm db:seed`.
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

export type Position = (typeof POSITIONS)[number]
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]
