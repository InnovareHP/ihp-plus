// The request forms a health plan actually runs on, as a starting point. Admins edit them on
// the Forms screen, so this is a first draft of each, not a fixed catalogue.
//
// Field ids are readable slugs rather than uuids because they key the stored answers: a
// submission reads `values.startDate`, and that is far easier to follow in a database row than
// a uuid would be. The builder generates uuids for questions added later, which is fine — an
// id only has to be stable, not pretty.

export type SeedFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox'

export interface SeedFormField {
  id: string
  type: SeedFieldType
  label: string
  help: string
  required: boolean
  options: string[]
  min?: number
  max?: number
}

export interface SeedRequestForm {
  name: string
  description: string
  /** Department names as seeded, or 'all' for every department in the organization. */
  departments: readonly string[] | 'all'
  fields: SeedFormField[]
}

function field(
  id: string,
  type: SeedFieldType,
  label: string,
  extra: Partial<Omit<SeedFormField, 'id' | 'type' | 'label'>> = {},
): SeedFormField {
  return { id, type, label, help: '', required: false, options: [], ...extra }
}

const CLINICAL = ['Care Management', 'Clinical Operations', 'Member Services'] as const
const LICENSED = [
  'Care Management',
  'Clinical Operations',
  'Provider Network',
  'Quality & Compliance',
] as const
const HOURLY = [
  'Care Management',
  'Clinical Operations',
  'Member Services',
  'Revenue Cycle',
] as const

export const REQUEST_FORM_SEED: readonly SeedRequestForm[] = [
  {
    name: 'Time off request',
    description: 'Book vacation, a personal day, or any other planned leave.',
    departments: 'all',
    fields: [
      field('leaveType', 'select', 'Type of leave', {
        required: true,
        options: [
          'Vacation',
          'Sick leave',
          'Personal day',
          'Bereavement',
          'Jury duty',
          'Parental leave',
          'Unpaid leave',
        ],
      }),
      field('startDate', 'date', 'First day off', { required: true }),
      field('endDate', 'date', 'Last day off', {
        required: true,
        help: 'The same day as the first for a single day.',
      }),
      field('coverage', 'textarea', 'Who is covering your work', {
        help: 'Name anyone who has agreed to pick up your caseload or shifts.',
      }),
      field('notes', 'textarea', 'Anything else we should know'),
    ],
  },
  {
    name: 'Equipment request',
    description: 'Ask for a laptop, monitor, headset, or anything else you need to work.',
    departments: 'all',
    fields: [
      field('item', 'text', 'What you need', {
        required: true,
        help: 'One item per request, so each can be approved on its own.',
      }),
      field('reason', 'textarea', 'Why you need it', { required: true }),
      field('neededBy', 'date', 'Needed by'),
      field('estimatedCost', 'number', 'Estimated cost', {
        help: 'In US dollars. Leave blank if you do not know.',
        min: 0,
        max: 10000,
      }),
      field('replacement', 'checkbox', 'This replaces equipment I already have'),
    ],
  },
  {
    name: 'IT support request',
    description: 'Report something broken, slow, or behaving unexpectedly.',
    departments: 'all',
    fields: [
      field('category', 'select', 'What is affected', {
        required: true,
        options: [
          'Account or password',
          'Laptop or hardware',
          'Software problem',
          'Network or VPN',
          'Phone or voicemail',
          'Printing or scanning',
          'Clinical system',
          'Something else',
        ],
      }),
      field('urgency', 'select', 'How much is it holding you up', {
        required: true,
        options: ['I cannot work at all', 'I can work around it', 'Minor annoyance'],
      }),
      field('summary', 'text', 'One-line summary', { required: true }),
      field('detail', 'textarea', 'What happened', {
        required: true,
        help: 'What you were doing, what you expected, and any error message word for word.',
      }),
      field('assetTag', 'text', 'Asset tag', {
        help: 'On the sticker underneath a company laptop, if this is about one.',
      }),
    ],
  },
  {
    name: 'System access request',
    description: 'Request access to a system, or a change to the access you already have.',
    departments: 'all',
    fields: [
      field('system', 'select', 'Which system', {
        required: true,
        options: [
          'Electronic health record',
          'Claims platform',
          'Care management platform',
          'Reporting and analytics',
          'Payroll and HR',
          'Shared drive',
          'Email distribution list',
          'Something else',
        ],
      }),
      field('accessLevel', 'select', 'Level of access', {
        required: true,
        options: ['Read only', 'Read and write', 'Administrator'],
      }),
      field('justification', 'textarea', 'Why your role needs it', {
        required: true,
        help: 'Compliance reviews these, so be specific about the work it unblocks.',
      }),
      field('neededFrom', 'date', 'Needed from'),
      field('temporary', 'checkbox', 'This access is temporary', {
        help: 'Tick if it can be removed after a project or cover period ends.',
      }),
    ],
  },
  {
    name: 'Expense reimbursement',
    description: 'Claim back something you paid for out of your own pocket.',
    departments: 'all',
    fields: [
      field('expenseType', 'select', 'Type of expense', {
        required: true,
        options: [
          'Travel',
          'Mileage',
          'Meals',
          'Conference or training',
          'Office supplies',
          'Professional licence or dues',
          'Something else',
        ],
      }),
      field('amount', 'number', 'Amount', {
        required: true,
        help: 'In US dollars, including tax.',
        min: 0,
        max: 25000,
      }),
      field('dateIncurred', 'date', 'Date of the expense', { required: true }),
      field('receipt', 'text', 'Receipt reference', {
        required: true,
        help: 'Email the receipts to finance and put the subject line or invoice number here.',
      }),
      field('description', 'textarea', 'What it was for', { required: true }),
    ],
  },
  {
    name: 'Overtime pre-approval',
    description: 'Get overtime agreed before you work it.',
    departments: HOURLY,
    fields: [
      field('shiftDate', 'date', 'Date of the overtime', { required: true }),
      field('hours', 'number', 'Hours expected', {
        required: true,
        min: 0.5,
        max: 16,
      }),
      field('reason', 'textarea', 'Why it is needed', {
        required: true,
        help: 'What will not get done otherwise, and why it cannot wait.',
      }),
      field('alternativesConsidered', 'textarea', 'What else you tried', {
        help: 'Redistributing the work, or picking it up in normal hours.',
      }),
    ],
  },
  {
    name: 'Shift change or swap',
    description: 'Change a shift you are rostered on, or hand it to a colleague.',
    departments: CLINICAL,
    fields: [
      field('shiftDate', 'date', 'Date of the shift', { required: true }),
      field('changeType', 'select', 'What you are asking for', {
        required: true,
        options: [
          'Swap with a colleague',
          'Change the start time',
          'Change the end time',
          'Drop the shift',
        ],
      }),
      field('colleague', 'text', 'Colleague covering it', {
        help: 'Who has already agreed, if this is a swap.',
      }),
      field('reason', 'textarea', 'Reason', { required: true }),
    ],
  },
  {
    name: 'Training and CEU request',
    description: 'Ask for a course, conference, or continuing education credits.',
    departments: LICENSED,
    fields: [
      field('courseName', 'text', 'Course or conference', { required: true }),
      field('provider', 'text', 'Who runs it', { required: true }),
      field('startDate', 'date', 'Start date'),
      field('cost', 'number', 'Cost', {
        help: 'In US dollars, including registration and materials.',
        min: 0,
        max: 25000,
      }),
      field('ceuCredits', 'number', 'CEU credits', {
        help: 'Leave blank if the course does not carry any.',
        min: 0,
        max: 100,
      }),
      field('relevance', 'textarea', 'How it applies to your role', { required: true }),
      field('timeAway', 'checkbox', 'I will need time away from my normal duties'),
    ],
  },
  {
    name: 'Staffing request',
    description: 'Ask to open a role, extend a contract, or bring in temporary cover.',
    departments: 'all',
    fields: [
      field('requestType', 'select', 'What you are asking for', {
        required: true,
        options: [
          'New permanent role',
          'Backfill for a leaver',
          'Extend an existing contract',
          'Temporary cover',
        ],
      }),
      field('roleTitle', 'text', 'Role title', { required: true }),
      field('startDate', 'date', 'Ideal start date'),
      field('headcount', 'number', 'How many people', {
        required: true,
        min: 1,
        max: 20,
      }),
      field('justification', 'textarea', 'Why the work needs another person', {
        required: true,
        help: 'The workload it covers, and what happens if it stays unfilled.',
      }),
      field('budgeted', 'checkbox', 'This is already in the department budget'),
    ],
  },
]
