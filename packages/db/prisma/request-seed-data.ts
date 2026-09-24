// The request forms a health plan actually runs on, as a starting point. Admins edit them on
// the Forms screen, so this is a first draft of each, not a fixed catalogue.
//
// Field ids are readable slugs rather than uuids because they key the stored answers: a
// submission reads `values.startDate`, and that is far easier to follow in a database row than
// a uuid would be. The builder generates uuids for questions added later, which is fine — an
// id only has to be stable, not pretty.

export type SeedFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'file'

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

export interface SeedEvaluationForm {
  name: string
  description: string
  fields: SeedFormField[]
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

// Every review scores on the same five points, so two reviewers mean the same thing by a 3.
function rating(id: string, label: string, help = ''): SeedFormField {
  return field(id, 'number', label, { required: true, help, min: 1, max: 5 })
}

const RATING_SCALE = '1 is well below what the role needs, 3 meets it, 5 is well above it.'

// No time field type exists, so a clock time is text with the format spelled out.
const TIME_HELP = 'Use the 24-hour clock, e.g. 18:00.'

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
          'Military leave',
          'FMLA',
          'Unpaid leave',
        ],
      }),
      field('startDate', 'date', 'First day off', { required: true }),
      field('endDate', 'date', 'Last day off', {
        required: true,
        help: 'The same day as the first for a single day.',
      }),
      field('dayPortion', 'select', 'Full or part days', {
        required: true,
        options: [
          'Full days',
          'First day is a half day',
          'Last day is a half day',
          'Half day only',
        ],
      }),
      field('totalHours', 'number', 'Total hours requested', {
        required: true,
        help: 'Working hours only, so payroll can draw the right balance.',
        min: 1,
        max: 2080,
      }),
      field('returnDate', 'date', 'First day back at work', { required: true }),
      field('coverage', 'textarea', 'Who is covering your work', {
        required: true,
        help: 'Name anyone who has agreed to pick up your caseload or shifts.',
      }),
      field('handover', 'textarea', 'What they need to know', {
        help: 'Open cases, deadlines that fall in the window, and anything mid-flight.',
      }),
      field('memberImpact', 'textarea', 'Members or clients affected', {
        help: 'Scheduled visits, assessments or calls that will have to move.',
      }),
      field('reachable', 'checkbox', 'I can be reached in an emergency'),
      field('balanceChecked', 'checkbox', 'I have checked I have the balance for this', {
        required: true,
      }),
      field('notes', 'textarea', 'Anything else we should know'),
    ],
  },
  {
    name: 'Equipment request',
    description: 'Ask for a laptop, monitor, headset, or anything else you need to work.',
    departments: 'all',
    fields: [
      field('category', 'select', 'Category', {
        required: true,
        options: [
          'Laptop or desktop',
          'Monitor or dock',
          'Headset or webcam',
          'Phone or tablet',
          'Printer or scanner',
          'Furniture',
          'Software licence',
          'Something else',
        ],
      }),
      field('item', 'text', 'What you need', {
        required: true,
        help: 'One item per request, so each can be approved on its own.',
      }),
      field('specification', 'textarea', 'Model or specification', {
        help: 'A link or part number if you have one, otherwise what it has to do.',
      }),
      field('quantity', 'number', 'How many', { required: true, min: 1, max: 50 }),
      field('reason', 'textarea', 'Why you need it', { required: true }),
      field('neededBy', 'date', 'Needed by'),
      field('estimatedCost', 'number', 'Estimated cost', {
        help: 'In US dollars. Leave blank if you do not know.',
        min: 0,
        max: 10000,
      }),
      field('costCentre', 'text', 'Cost centre', {
        help: 'The code finance should bill it to, if you know it.',
      }),
      field('deliverTo', 'select', 'Where it should go', {
        required: true,
        options: ['Office', 'Home address', 'Client site'],
      }),
      field('replacement', 'checkbox', 'This replaces equipment I already have'),
      field('returnedAssetTag', 'text', 'Asset tag being replaced', {
        help: 'On the sticker underneath the old device, if this is a replacement.',
      }),
      field('policyAccepted', 'checkbox', 'I accept the acceptable use policy for this device', {
        required: true,
      }),
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
          'Email or calendar',
          'Something else',
        ],
      }),
      field('urgency', 'select', 'How much is it holding you up', {
        required: true,
        options: ['I cannot work at all', 'I can work around it', 'Minor annoyance'],
      }),
      field('scope', 'select', 'Who else is hitting it', {
        required: true,
        options: ['Just me', 'A few colleagues', 'My whole department', 'Everyone'],
      }),
      field('summary', 'text', 'One-line summary', { required: true }),
      field('detail', 'textarea', 'What happened', {
        required: true,
        help: 'What you were doing, what you expected, and any error message word for word.',
      }),
      field('firstNoticed', 'date', 'When it started'),
      field('stepsToReproduce', 'textarea', 'How to make it happen again', {
        help: 'The exact clicks, if it happens every time.',
      }),
      field('workaround', 'textarea', 'What you have already tried'),
      field('system', 'text', 'System or application name'),
      field('assetTag', 'text', 'Asset tag', {
        help: 'On the sticker underneath a company laptop, if this is about one.',
      }),
      field('phiInvolved', 'checkbox', 'Member or patient data may be exposed', {
        help: 'Tick this and compliance is notified alongside IT.',
      }),
      field('contactNumber', 'text', 'Best number to reach you on'),
      field('preferredContact', 'select', 'How you would rather be contacted', {
        options: ['Email', 'Phone', 'Teams message'],
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
      field('environment', 'select', 'Which environment', {
        required: true,
        options: ['Production', 'Test', 'Training'],
      }),
      field('changeType', 'select', 'What you are asking for', {
        required: true,
        options: ['New access', 'More access than I have', 'Match a colleague', 'Remove access'],
      }),
      field('accessLevel', 'select', 'Level of access', {
        required: true,
        options: ['Read only', 'Read and write', 'Administrator'],
      }),
      field('roleProfile', 'text', 'Role or permission profile', {
        help: 'The named profile, if the system has one.',
      }),
      field('matchColleague', 'text', 'Colleague whose access to match', {
        help: 'Only if you are asking for the same access someone else already has.',
      }),
      field('justification', 'textarea', 'Why your role needs it', {
        required: true,
        help: 'Compliance reviews these, so be specific about the work it unblocks.',
      }),
      field('neededFrom', 'date', 'Needed from'),
      field('neededUntil', 'date', 'Needed until', {
        help: 'Leave blank if this is part of your permanent role.',
      }),
      field('temporary', 'checkbox', 'This access is temporary', {
        help: 'Tick if it can be removed after a project or cover period ends.',
      }),
      field('phiAccess', 'checkbox', 'This gives access to member or patient data'),
      field('trainingComplete', 'checkbox', 'My HIPAA and security training is current', {
        required: true,
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
          'Lodging',
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
      field('merchant', 'text', 'Who you paid', { required: true }),
      field('paymentMethod', 'select', 'How you paid', {
        required: true,
        options: ['Personal card', 'Cash', 'Personal vehicle', 'Company card in my name'],
      }),
      field('mileage', 'number', 'Miles driven', {
        help: 'Only for mileage claims; the rate is applied by finance.',
        min: 0,
        max: 5000,
      }),
      field('description', 'textarea', 'What it was for', { required: true }),
      field('businessPurpose', 'textarea', 'Business purpose', {
        required: true,
        help: 'Who was there and what it achieved — the IRS test, not just the category.',
      }),
      field('costCentre', 'text', 'Cost centre'),
      field('clientRelated', 'checkbox', 'This was for a specific client'),
      field('clientName', 'text', 'Which client'),
      field('receipt', 'file', 'Receipt', {
        required: true,
        help: 'A photo or PDF of the receipt or invoice, up to 25 MB.',
      }),
      field('policyAccepted', 'checkbox', 'This claim follows the travel and expense policy', {
        required: true,
      }),
    ],
  },
  {
    name: 'Overtime pre-approval',
    description: 'Get overtime agreed before you work it.',
    departments: HOURLY,
    fields: [
      field('shiftDate', 'date', 'Date of the overtime', { required: true }),
      field('startTime', 'text', 'Start time', { required: true, help: TIME_HELP }),
      field('endTime', 'text', 'End time', { required: true, help: TIME_HELP }),
      field('hours', 'number', 'Hours expected', { required: true, min: 0.5, max: 16 }),
      field('workPlanned', 'textarea', 'What you will be working on', { required: true }),
      field('reason', 'textarea', 'Why it is needed', {
        required: true,
        help: 'What will not get done otherwise, and why it cannot wait.',
      }),
      field('alternativesConsidered', 'textarea', 'What else you tried', {
        help: 'Redistributing the work, or picking it up in normal hours.',
      }),
      field('compensation', 'select', 'How it should be paid', {
        required: true,
        options: ['Paid overtime', 'Time off in lieu'],
      }),
      field('costCentre', 'text', 'Cost centre'),
      field('discussedWithManager', 'checkbox', 'I have already raised this with my manager'),
    ],
  },
  {
    name: 'Shift change or swap',
    description: 'Change a shift you are rostered on, or hand it to a colleague.',
    departments: CLINICAL,
    fields: [
      field('shiftDate', 'date', 'Date of the shift', { required: true }),
      field('shiftTime', 'text', 'Time of the shift', { required: true, help: TIME_HELP }),
      field('changeType', 'select', 'What you are asking for', {
        required: true,
        options: [
          'Swap with a colleague',
          'Change the start time',
          'Change the end time',
          'Move to another day',
          'Drop the shift',
        ],
      }),
      field('newDate', 'date', 'New date', {
        help: 'Only if the shift is moving to a different day.',
      }),
      field('newTime', 'text', 'New time', { help: TIME_HELP }),
      field('colleague', 'text', 'Colleague covering it', {
        help: 'Who has already agreed, if this is a swap.',
      }),
      field('colleagueAgreed', 'checkbox', 'They have agreed to it'),
      field('licensureMatch', 'checkbox', 'They hold the licence this shift needs'),
      field('reason', 'textarea', 'Reason', { required: true }),
      field('coverageRisk', 'textarea', 'What is at risk if this is refused', {
        help: 'Scheduled member visits or assessments that would be missed.',
      }),
    ],
  },
  {
    name: 'Training and CEU request',
    description: 'Ask for a course, conference, or continuing education credits.',
    departments: LICENSED,
    fields: [
      field('courseName', 'text', 'Course or conference', { required: true }),
      field('provider', 'text', 'Who runs it', { required: true }),
      field('format', 'select', 'Format', {
        required: true,
        options: ['In person', 'Virtual, live', 'Self-paced online'],
      }),
      field('startDate', 'date', 'Start date'),
      field('endDate', 'date', 'End date'),
      field('location', 'text', 'Where it is held'),
      field('cost', 'number', 'Registration cost', {
        help: 'In US dollars, including materials.',
        min: 0,
        max: 25000,
      }),
      field('travelCost', 'number', 'Travel and lodging cost', {
        help: 'Estimate it; the expense claim comes afterwards.',
        min: 0,
        max: 25000,
      }),
      field('costCentre', 'text', 'Cost centre'),
      field('ceuCredits', 'number', 'CEU credits', {
        help: 'Leave blank if the course does not carry any.',
        min: 0,
        max: 100,
      }),
      field('accreditingBody', 'text', 'Accrediting body', {
        help: 'Who awards the credits, e.g. ANCC or NASW.',
      }),
      field('licenseRenewal', 'checkbox', 'These credits count towards a licence I have to renew'),
      field('relevance', 'textarea', 'How it applies to your role', { required: true }),
      field('sharePlan', 'textarea', 'How you will share it with the team', {
        help: 'A brown bag, written notes, or an update to a procedure.',
      }),
      field('timeAway', 'checkbox', 'I will need time away from my normal duties'),
      field('hoursAway', 'number', 'Working hours away', { min: 0, max: 200 }),
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
      field('employmentType', 'select', 'Employment type', {
        required: true,
        options: ['Full-time', 'Part-time', 'Contract', 'Per diem'],
      }),
      field('headcount', 'number', 'How many people', { required: true, min: 1, max: 20 }),
      field('startDate', 'date', 'Ideal start date'),
      field('endDate', 'date', 'End date', {
        help: 'Only for cover or a fixed-term contract.',
      }),
      field('reportsTo', 'text', 'Who they report to', { required: true }),
      field('licensureRequired', 'text', 'Licence or certification required', {
        help: 'Leave blank if the role needs none.',
      }),
      field('salaryRange', 'text', 'Salary or rate range', {
        help: 'Annual for salaried roles, hourly for per diem and contract.',
      }),
      field('costCentre', 'text', 'Cost centre'),
      field('budgeted', 'checkbox', 'This is already in the department budget'),
      field('justification', 'textarea', 'Why the work needs another person', {
        required: true,
        help: 'The workload it covers, and what happens if it stays unfilled.',
      }),
      field('workload', 'textarea', 'What the role would own', { required: true }),
      field('riskIfUnfilled', 'textarea', 'What is at risk if this is refused', {
        help: 'Caseload ratios, turnaround times, or a contractual commitment.',
      }),
    ],
  },
]

/**
 * Evaluation forms: the same questions machinery, filled in by a supervisor about one person
 * rather than raised by the person themselves, so they carry no departments.
 */
export const EVALUATION_FORM_SEED: readonly SeedEvaluationForm[] = [
  {
    name: 'Probationary review',
    description: 'How a new hire has settled in, and whether they should be made regular.',
    fields: [
      field('periodStart', 'date', 'Probation started', { required: true }),
      field('periodEnd', 'date', 'Probation ends', { required: true }),
      rating('jobKnowledge', 'Job knowledge', RATING_SCALE),
      rating('qualityOfWork', 'Quality and accuracy of work'),
      rating('productivity', 'Volume of work handled'),
      rating('reliability', 'Attendance and punctuality'),
      rating('communication', 'Communication with colleagues and members'),
      rating('teamwork', 'Working with the rest of the team'),
      rating('policyCompliance', 'Following policy, privacy and documentation standards'),
      rating('overallRating', 'Overall rating'),
      field('strengths', 'textarea', 'What they do well', { required: true }),
      field('gaps', 'textarea', 'Where they still need support', { required: true }),
      field('supportProvided', 'textarea', 'Training and support given so far', {
        help: 'What has already been tried, so a decision to extend is an informed one.',
      }),
      field('recommendation', 'select', 'Recommendation', {
        required: true,
        options: ['Make regular', 'Extend probation', 'End employment'],
      }),
      field('extensionMonths', 'number', 'Extend by how many months', {
        help: 'Only if you are recommending an extension.',
        min: 1,
        max: 6,
      }),
      field('goals', 'textarea', 'What they should focus on next', { required: true }),
      field('employeeComments', 'textarea', 'What they said in the conversation'),
      field('discussed', 'checkbox', 'I have gone through this with them', { required: true }),
    ],
  },
  {
    name: 'Annual performance review',
    description: 'The yearly conversation, written down: what happened and what comes next.',
    fields: [
      field('periodStart', 'date', 'Review period from', { required: true }),
      field('periodEnd', 'date', 'Review period to', { required: true }),
      rating('jobKnowledge', 'Job knowledge and technical skill', RATING_SCALE),
      rating('qualityOfWork', 'Quality and accuracy of work'),
      rating('productivity', 'Volume of work handled'),
      rating('reliability', 'Dependability and follow-through'),
      rating('communication', 'Communication, written and spoken'),
      rating('teamwork', 'Working with the rest of the team'),
      rating('initiative', 'Initiative and problem solving'),
      rating('memberFocus', 'Care for members, providers and clients'),
      rating('policyCompliance', 'Following policy, privacy and documentation standards'),
      rating('overallRating', 'Overall rating'),
      field('achievements', 'textarea', 'What they delivered this year', { required: true }),
      field('goalsReviewed', 'textarea', 'How last year’s goals went', {
        help: 'Each goal set last year and whether it was met.',
      }),
      field('development', 'textarea', 'What they should work on next year', { required: true }),
      field('trainingNeeds', 'textarea', 'Training or certification that would help'),
      field('goals', 'textarea', 'Goals agreed for next year', { required: true }),
      field('promotionReadiness', 'select', 'Readiness for more responsibility', {
        required: true,
        options: ['Ready now', 'Ready within a year', 'Not yet', 'Not applicable'],
      }),
      field('retentionRisk', 'select', 'Risk of losing them', {
        required: true,
        options: ['Low', 'Medium', 'High'],
      }),
      field('employeeComments', 'textarea', 'What they said in the conversation'),
      field('discussed', 'checkbox', 'I have gone through this with them', { required: true }),
    ],
  },
]
