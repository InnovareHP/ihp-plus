// The starting new-hire checklist. Each organization edits its own copy on Organization →
// Onboarding, so this is a starting point, not the source of truth.

/** What every new hire ticks off in their first days, in order. */
export const NEW_HIRE_TASK_SEED: readonly { title: string; description: string }[] = [
  {
    title: 'Collect your laptop and badge',
    description: 'Information Technology hands them over on your first morning.',
  },
  {
    title: 'Sign in to Outlook and Teams',
    description: 'Use the company account from your welcome email.',
  },
  {
    title: 'Meet your department lead',
    description: 'A short hello to agree what your first two weeks look like.',
  },
  {
    title: 'Clock in on the time clock',
    description: 'Attendance → Time clock, at the start of your first shift.',
  },
  {
    title: 'Complete HIPAA privacy training',
    description: 'Required before you open any member or patient record.',
  },
  {
    title: 'Set up direct deposit with People & Culture',
    description: 'Bring a voided cheque or your bank letter.',
  },
]

/**
 * Bluebook documents filed under these categories become required reading. The seed cannot
 * create the documents themselves: each one is an uploaded file.
 */
export const REQUIRED_READING_CATEGORIES: readonly string[] = ['Onboarding', 'Policy', 'Compliance']

/** A starter shift library; the first is the one a new hire without a shift is given. */
export const SHIFT_SEED: readonly {
  name: string
  shiftStartMinutes: number
  shiftEndMinutes: number
  workdays: string
}[] = [
  { name: 'Day shift', shiftStartMinutes: 9 * 60, shiftEndMinutes: 18 * 60, workdays: '1,2,3,4,5' },
  {
    name: 'Early shift',
    shiftStartMinutes: 7 * 60,
    shiftEndMinutes: 16 * 60,
    workdays: '1,2,3,4,5',
  },
  // Ends after midnight, which the clock counts toward the day the shift started.
  {
    name: 'Night shift',
    shiftStartMinutes: 22 * 60,
    shiftEndMinutes: 7 * 60,
    workdays: '1,2,3,4,5',
  },
]
