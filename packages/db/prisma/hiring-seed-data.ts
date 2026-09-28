// Demo hiring data on example.com addresses and 555-01xx numbers, so nothing here can reach a person.

import type { SeedFormField } from './request-seed-data'

function field(
  id: string,
  type: SeedFormField['type'],
  label: string,
  extra: Partial<Omit<SeedFormField, 'id' | 'type' | 'label'>> = {},
): SeedFormField {
  return { id, type, label, help: '', required: false, options: [], ...extra }
}

function rating(id: string, label: string): SeedFormField {
  return field(id, 'number', label, {
    required: true,
    help: '1 is well below what the role needs, 3 meets it, 5 is well above it.',
    min: 1,
    max: 5,
  })
}

// Mirrors DEFAULT_STAGES and DEFAULT_REJECTION_MESSAGE in apps/web/src/features/hiring/schema.ts.
export const HIRING_SETTINGS_SEED = {
  hrDepartment: 'People & Culture',
  timeZone: 'Asia/Manila',
  rejectionMessage:
    'Thank you for your interest and for the time you put into applying. We have decided not to move forward with your application for this role, and we wish you the best in your search.',
  defaultStages: [
    { id: 'applied', name: 'Applied', message: '' },
    { id: 'screening', name: 'Screening', message: '' },
    {
      id: 'interview',
      name: 'Interview',
      message:
        'Thank you for applying. We would like to meet you — we will be in touch shortly to find a time that suits you.',
    },
    { id: 'offer', name: 'Offer', message: '' },
  ],
}

export interface SeedStage {
  id: string
  name: string
  message: string
}

const DEFAULT_STAGES: SeedStage[] = HIRING_SETTINGS_SEED.defaultStages

const CLINICAL_STAGES: SeedStage[] = [
  { id: 'applied', name: 'Applied', message: '' },
  {
    id: 'screening',
    name: 'Phone screen',
    message:
      'Thanks for applying. A member of our clinical recruiting team will call you in the next few days for a short conversation about the role.',
  },
  {
    id: 'interview',
    name: 'Clinical interview',
    message:
      'We enjoyed speaking with you and would like you to meet our clinical leads. You will receive a few interview times to choose from.',
  },
  {
    id: 'references',
    name: 'Reference checks',
    message:
      'You are nearly there. We are contacting the references you provided and will be in touch once we hear back.',
  },
  { id: 'offer', name: 'Offer', message: '' },
]

const ENGINEERING_STAGES: SeedStage[] = [
  { id: 'applied', name: 'Applied', message: '' },
  { id: 'screening', name: 'Recruiter screen', message: '' },
  {
    id: 'technical',
    name: 'Technical interview',
    message:
      'Thanks for the great conversation. The next step is a 90-minute technical interview with two of our engineers — no take-home, no whiteboard puzzles.',
  },
  {
    id: 'panel',
    name: 'Team panel',
    message:
      'You have been invited to meet the wider data team. It is a relaxed conversation about how we work together.',
  },
  { id: 'offer', name: 'Offer', message: '' },
]

const HEARD_ABOUT = [
  'LinkedIn',
  'Indeed',
  'Referral from an employee',
  'Our careers page',
  'Job fair',
  'Other',
]

export interface SeedHiringForm {
  kind: 'application' | 'scorecard'
  name: string
  description: string
  fields: SeedFormField[]
}

export const GENERAL_APPLICATION = 'General application questions'
export const CLINICAL_APPLICATION = 'Clinical application questions'
export const STANDARD_SCORECARD = 'Standard interview scorecard'
export const TECHNICAL_SCORECARD = 'Technical interview scorecard'

export const HIRING_FORM_SEED: readonly SeedHiringForm[] = [
  {
    kind: 'application',
    name: GENERAL_APPLICATION,
    description: 'Asked on every non-clinical posting, after the contact details and resume.',
    fields: [
      field('startDate', 'date', 'Earliest start date', { required: true }),
      field('workAuthorized', 'checkbox', 'I am authorized to work where this role is based', {
        required: true,
      }),
      field('heardAbout', 'select', 'How did you hear about this role?', {
        required: true,
        options: HEARD_ABOUT,
      }),
      field('portfolio', 'text', 'LinkedIn or portfolio link', {
        help: 'Optional, but it helps us get to know your work.',
      }),
      field('whyUs', 'textarea', 'Why do you want to work with us?', {
        help: 'A few sentences is plenty.',
      }),
    ],
  },
  {
    kind: 'application',
    name: CLINICAL_APPLICATION,
    description:
      'For licensed clinical roles: licensure and shift preference on top of the basics.',
    fields: [
      field('licenseType', 'select', 'Current license', {
        required: true,
        options: ['RN', 'BSN-RN', 'LPN', 'NP', 'Other'],
      }),
      field('licenseState', 'text', 'State of licensure', {
        required: true,
        help: 'The state your active license was issued in, e.g. Michigan.',
      }),
      field('yearsClinical', 'number', 'Years of clinical experience', {
        required: true,
        min: 0,
        max: 50,
      }),
      field('shiftPreference', 'select', 'Preferred shift', {
        required: true,
        options: ['Days', 'Evenings', 'Nights', 'Flexible'],
      }),
      field('startDate', 'date', 'Earliest start date', { required: true }),
      field('workAuthorized', 'checkbox', 'I am authorized to work in the United States', {
        required: true,
      }),
      field('heardAbout', 'select', 'How did you hear about this role?', {
        required: true,
        options: HEARD_ABOUT,
      }),
      field('whyUs', 'textarea', 'What draws you to care management?'),
    ],
  },
  {
    kind: 'scorecard',
    name: STANDARD_SCORECARD,
    description:
      'The same four points for every interview, so two interviewers mean the same thing.',
    fields: [
      rating('communication', 'Communication'),
      rating('roleSkills', 'Role-specific skills'),
      rating('teamwork', 'Teamwork and collaboration'),
      rating('values', 'Alignment with patient-first values'),
      field('strengths', 'textarea', 'Strengths', { required: true }),
      field('concerns', 'textarea', 'Concerns or gaps'),
    ],
  },
  {
    kind: 'scorecard',
    name: TECHNICAL_SCORECARD,
    description: 'For engineering interviews: problem solving, design and data modelling.',
    fields: [
      rating('problemSolving', 'Problem solving'),
      rating('systemDesign', 'System design'),
      rating('dataModeling', 'Data modelling'),
      rating('communication', 'Explains their thinking'),
      field('notes', 'textarea', 'Evidence for the scores', { required: true }),
    ],
  },
]

type Answers = Record<string, string | number | boolean>

export type SeedRecommendation = 'strong_yes' | 'yes' | 'no' | 'strong_no'

export interface SeedInterview {
  format: 'video' | 'onsite' | 'phone'
  location: string
  note: string
  durationMinutes: 15 | 30 | 45 | 60 | 90
  status: 'offered' | 'booked' | 'reschedule_requested' | 'cancelled'
  /** Days from now of the first time offered, which is also the booked one; negative is past. */
  day: number
  /** Hour in the posting's time zone. */
  hour: number
  /** How many times were offered; they run on consecutive days. */
  slots: number
  /** Indexes into the organization's members, oldest first; missing members are skipped. */
  interviewers: number[]
  feedback?: { interviewer: number; recommendation: SeedRecommendation; values: Answers }[]
}

export interface SeedApplicant {
  fullName: string
  email: string
  phone: string
  status: 'active' | 'hired' | 'rejected' | 'withdrawn'
  /** The stage they sit in; a closed-out application keeps the stage it ended at. */
  stageId: string
  appliedDaysAgo: number
  answers: Answers
  rejectionReason?: string
  notes?: { daysAgo: number; body: string }[]
  interview?: SeedInterview
}

export interface SeedPosting {
  slug: string
  title: string
  summary: string
  description: string
  location: string
  workplace: 'onsite' | 'hybrid' | 'remote'
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary'
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string
  salaryPeriod: 'year' | 'month' | 'hour'
  status: 'draft' | 'open' | 'closed' | 'archived'
  resumeRequired: boolean
  department: string
  /** Where the job is, which the interview hours are written in. */
  timeZone: string
  stages: SeedStage[]
  applicationForm: string | null
  scorecardForm: string | null
  /** Null for a draft, which has never been open. */
  openedDaysAgo: number | null
  /** Days from now; negative means the deadline has passed. */
  closesInDays: number | null
  applicants: SeedApplicant[]
}

/** An ISO date n days from now, the form an answered date question stores. */
function inDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function emailOf(fullName: string) {
  const local = fullName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '')
  return `${local}@example.com`
}

function applicant(
  fullName: string,
  phone: string,
  rest: Omit<SeedApplicant, 'fullName' | 'email' | 'phone'>,
): SeedApplicant {
  return { fullName, email: emailOf(fullName), phone, ...rest }
}

function clinical(
  licenseType: string,
  yearsClinical: number,
  shiftPreference: string,
  heardAbout: string,
  startInDays: number,
  whyUs = '',
): Answers {
  return {
    licenseType,
    licenseState: 'Michigan',
    yearsClinical,
    shiftPreference,
    startDate: inDays(startInDays),
    workAuthorized: true,
    heardAbout,
    ...(whyUs ? { whyUs } : {}),
  }
}

function general(heardAbout: string, startInDays: number, whyUs = '', portfolio = ''): Answers {
  return {
    startDate: inDays(startInDays),
    workAuthorized: true,
    heardAbout,
    ...(portfolio ? { portfolio } : {}),
    ...(whyUs ? { whyUs } : {}),
  }
}

const GRAND_RAPIDS_OFFICE =
  '4221 Bud Dr NE, Comstock Park, MI 49321 — ask for Clinical Recruiting at the front desk.'
const MAKATI_OFFICE =
  '12F Ayala Tower One, Ayala Avenue, Makati City — sign in at the lobby with a valid ID.'

export const HIRING_POSTING_SEED: readonly SeedPosting[] = [
  {
    slug: 'registered-nurse-care-manager-demo01',
    title: 'Registered Nurse — Care Manager',
    summary: 'Coordinate care for members with complex chronic conditions across West Michigan.',
    description: `As a Registered Nurse Care Manager you will be the steady point of contact for a caseload of about 60 members living with diabetes, heart failure and COPD. You will build care plans with each member, their family and their physicians, and follow them through transitions in and out of the hospital.

What you will do
- Complete comprehensive assessments by phone and in person
- Build and update individualized care plans with measurable goals
- Coordinate with PCPs, specialists, pharmacies and community resources
- Follow up within 48 hours of every discharge to prevent readmission
- Document accurately in our care management platform

What you bring
- An active, unrestricted Michigan RN license (BSN preferred)
- Three or more years of clinical experience; care management or home health a plus
- Comfort with motivational interviewing and hard conversations
- A valid driver's license for occasional home visits

We offer full medical, dental and vision coverage from day one, a 6% 401(k) match, 25 days of paid time off and a CCM certification stipend.`,
    location: 'Grand Rapids, MI',
    workplace: 'hybrid',
    employmentType: 'full_time',
    salaryMin: 78000,
    salaryMax: 94000,
    salaryCurrency: 'USD',
    salaryPeriod: 'year',
    status: 'open',
    resumeRequired: true,
    department: 'Care Management',
    timeZone: 'America/Detroit',
    stages: CLINICAL_STAGES,
    applicationForm: CLINICAL_APPLICATION,
    scorecardForm: STANDARD_SCORECARD,
    openedDaysAgo: 34,
    closesInDays: 21,
    applicants: [
      applicant('Maria Santos', '+1 616 555 0101', {
        status: 'active',
        stageId: 'offer',
        appliedDaysAgo: 30,
        answers: clinical(
          'BSN-RN',
          9,
          'Days',
          'Referral from an employee',
          30,
          'I have spent six years in home health watching the same members bounce back to the ER. I want to be on the side that stops that from happening.',
        ),
        notes: [
          {
            daysAgo: 26,
            body: 'Phone screen: warm, organized, strong CHF background. Referred by Dana in Clinical Ops.',
          },
          { daysAgo: 12, body: 'Both references glowing — "the nurse families ask for by name".' },
          {
            daysAgo: 3,
            body: 'Verbal offer at $91k accepted pending the written offer. Wants a start after her notice period.',
          },
        ],
        interview: {
          format: 'onsite',
          location: GRAND_RAPIDS_OFFICE,
          note: 'Please bring a copy of your nursing license. Parking is free in the visitor lot.',
          durationMinutes: 60,
          status: 'booked',
          day: -18,
          hour: 10,
          slots: 3,
          interviewers: [0, 1],
          feedback: [
            {
              interviewer: 0,
              recommendation: 'strong_yes',
              values: {
                communication: 5,
                roleSkills: 5,
                teamwork: 4,
                values: 5,
                strengths:
                  'Walked through a heart-failure readmission case with real clinical depth. Clear, calm and member-centred.',
                concerns: 'Limited experience with our documentation platform; easily trained.',
              },
            },
            {
              interviewer: 1,
              recommendation: 'yes',
              values: {
                communication: 4,
                roleSkills: 5,
                teamwork: 4,
                values: 5,
                strengths:
                  'Excellent assessment skills and a strong sense of ownership over her caseload.',
                concerns: 'Asked about a four-day week — worth clarifying before the offer.',
              },
            },
          ],
        },
      }),
      applicant('James Whitaker', '+1 616 555 0102', {
        status: 'active',
        stageId: 'references',
        appliedDaysAgo: 24,
        answers: clinical('RN', 5, 'Flexible', 'LinkedIn', 45),
        notes: [
          {
            daysAgo: 4,
            body: 'Waiting on his second reference from Spectrum Health — followed up by email today.',
          },
        ],
        interview: {
          format: 'video',
          location: '',
          note: 'We will send a Teams link with the invitation. Plan for about an hour.',
          durationMinutes: 60,
          status: 'booked',
          day: -8,
          hour: 14,
          slots: 3,
          interviewers: [0, 1],
          feedback: [
            {
              interviewer: 0,
              recommendation: 'yes',
              values: {
                communication: 4,
                roleSkills: 4,
                teamwork: 4,
                values: 4,
                strengths: 'Solid med-surg foundation and good instincts on escalation.',
                concerns:
                  'No care management experience yet; would need a structured first 90 days.',
              },
            },
          ],
        },
      }),
      applicant('Aisha Rahman', '+1 616 555 0103', {
        status: 'active',
        stageId: 'interview',
        appliedDaysAgo: 15,
        answers: clinical('BSN-RN', 7, 'Days', 'Indeed', 30),
        interview: {
          format: 'onsite',
          location: GRAND_RAPIDS_OFFICE,
          note: 'Please bring a copy of your nursing license.',
          durationMinutes: 60,
          status: 'booked',
          day: 2,
          hour: 9,
          slots: 3,
          interviewers: [0, 1],
        },
      }),
      applicant('Daniel Okafor', '+1 616 555 0104', {
        status: 'active',
        stageId: 'interview',
        appliedDaysAgo: 11,
        answers: clinical('RN', 4, 'Evenings', 'Our careers page', 21),
        interview: {
          format: 'video',
          location: '',
          note: 'We will send a Teams link once you pick a time.',
          durationMinutes: 45,
          status: 'offered',
          day: 3,
          hour: 13,
          slots: 4,
          interviewers: [0],
        },
      }),
      applicant('Emily Chen', '+1 616 555 0105', {
        status: 'active',
        stageId: 'screening',
        appliedDaysAgo: 6,
        answers: clinical(
          'NP',
          12,
          'Days',
          'LinkedIn',
          60,
          'Looking for a role where I can focus on prevention rather than acute care.',
        ),
        notes: [
          {
            daysAgo: 2,
            body: 'NP — may be over-qualified for this role; ask whether she would consider the clinical lead opening.',
          },
        ],
      }),
      applicant('Robert Kowalski', '+1 616 555 0106', {
        status: 'active',
        stageId: 'applied',
        appliedDaysAgo: 2,
        answers: clinical('RN', 2, 'Nights', 'Job fair', 14),
      }),
      applicant('Priya Nair', '+1 616 555 0107', {
        status: 'active',
        stageId: 'applied',
        appliedDaysAgo: 0,
        answers: clinical('BSN-RN', 6, 'Flexible', 'Indeed', 30),
      }),
      applicant('Kevin Brooks', '+1 616 555 0108', {
        status: 'rejected',
        stageId: 'screening',
        appliedDaysAgo: 28,
        answers: clinical('LPN', 3, 'Days', 'Indeed', 7),
        rejectionReason: 'The role needs an active RN license; he holds an LPN.',
      }),
      applicant('Sofia Martinez', '+1 616 555 0109', {
        status: 'withdrawn',
        stageId: 'interview',
        appliedDaysAgo: 22,
        answers: clinical('RN', 8, 'Days', 'LinkedIn', 30),
        notes: [
          { daysAgo: 9, body: 'Withdrew — accepted a counter-offer from her current employer.' },
        ],
        interview: {
          format: 'phone',
          location: '+1 616 555 0199',
          note: 'We will call you from this number at the time you pick.',
          durationMinutes: 30,
          status: 'cancelled',
          day: -10,
          hour: 11,
          slots: 2,
          interviewers: [1],
        },
      }),
    ],
  },
  {
    slug: 'member-services-representative-demo02',
    title: 'Member Services Representative',
    summary: 'Be the friendly voice members reach when they have a question about their coverage.',
    description: `Our Member Services team answers the calls, chats and emails members send when they need help understanding their benefits, finding a doctor or sorting out a claim. You will resolve most questions on the first contact and hand the rest to the right team with everything they need.

What you will do
- Handle 40–60 member contacts a day across phone, chat and email
- Explain benefits, deductibles and prior authorization in plain language
- Help members find in-network providers and schedule appointments
- Log every interaction accurately and escalate complaints within policy

What you bring
- At least one year in a contact center, ideally healthcare or insurance (BPO welcome)
- Excellent spoken and written English
- Patience, empathy and a genuine wish to fix things for people
- Willingness to work a US-hours night shift, with a night differential

Paid training for three weeks, HMO coverage for you and two dependents from day one, and a clear path to Senior Representative and Team Lead.`,
    location: 'Makati City, Philippines',
    workplace: 'hybrid',
    employmentType: 'full_time',
    salaryMin: 28000,
    salaryMax: 35000,
    salaryCurrency: 'PHP',
    salaryPeriod: 'month',
    status: 'open',
    resumeRequired: true,
    department: 'Member Services',
    timeZone: 'Asia/Manila',
    stages: DEFAULT_STAGES,
    applicationForm: GENERAL_APPLICATION,
    scorecardForm: STANDARD_SCORECARD,
    openedDaysAgo: 20,
    closesInDays: null,
    applicants: [
      applicant('Angelica Reyes', '+63 917 555 0111', {
        status: 'hired',
        stageId: 'offer',
        appliedDaysAgo: 19,
        answers: general(
          'Referral from an employee',
          7,
          'I love helping people untangle confusing paperwork, and healthcare is where it matters most.',
        ),
        notes: [{ daysAgo: 2, body: 'Offer signed. Joining the next training batch.' }],
        interview: {
          format: 'onsite',
          location: MAKATI_OFFICE,
          note: 'The interview includes a short mock call. Wear what you would wear to work.',
          durationMinutes: 45,
          status: 'booked',
          day: -9,
          hour: 15,
          slots: 3,
          interviewers: [1],
          feedback: [
            {
              interviewer: 1,
              recommendation: 'strong_yes',
              values: {
                communication: 5,
                roleSkills: 4,
                teamwork: 5,
                values: 5,
                strengths:
                  'Handled the angry-caller mock with real empathy and still resolved it in four minutes.',
              },
            },
          ],
        },
      }),
      applicant('Mark Anthony Dela Cruz', '+63 917 555 0112', {
        status: 'active',
        stageId: 'offer',
        appliedDaysAgo: 17,
        answers: general('Indeed', 14),
        interview: {
          format: 'onsite',
          location: MAKATI_OFFICE,
          note: 'The interview includes a short mock call.',
          durationMinutes: 45,
          status: 'booked',
          day: -6,
          hour: 10,
          slots: 3,
          interviewers: [1],
          feedback: [
            {
              interviewer: 1,
              recommendation: 'yes',
              values: {
                communication: 4,
                roleSkills: 4,
                teamwork: 4,
                values: 4,
                strengths: 'Two years at a US insurance account; knows the vocabulary already.',
                concerns: 'A little scripted — coaching on tone will help.',
              },
            },
          ],
        },
      }),
      applicant('Kristine Mae Villanueva', '+63 917 555 0113', {
        status: 'active',
        stageId: 'interview',
        appliedDaysAgo: 10,
        answers: general('Job fair', 7),
        interview: {
          format: 'video',
          location: '',
          note: 'We will send a Teams link. Please test your headset beforehand.',
          durationMinutes: 30,
          status: 'reschedule_requested',
          day: 1,
          hour: 16,
          slots: 3,
          interviewers: [1],
        },
        notes: [
          {
            daysAgo: 1,
            body: 'None of the times worked — she is on a day shift until Friday. Offer evening slots.',
          },
        ],
      }),
      applicant('John Paul Bautista', '+63 917 555 0114', {
        status: 'active',
        stageId: 'interview',
        appliedDaysAgo: 8,
        answers: general('LinkedIn', 30, '', 'https://www.linkedin.com/in/example-jp-bautista'),
        interview: {
          format: 'onsite',
          location: MAKATI_OFFICE,
          note: 'The interview includes a short mock call.',
          durationMinutes: 45,
          status: 'booked',
          day: 1,
          hour: 14,
          slots: 2,
          interviewers: [1],
        },
      }),
      applicant('Camille Ramos', '+63 917 555 0115', {
        status: 'active',
        stageId: 'screening',
        appliedDaysAgo: 5,
        answers: general('Our careers page', 14),
      }),
      applicant('Rafael Mendoza', '+63 917 555 0116', {
        status: 'active',
        stageId: 'screening',
        appliedDaysAgo: 4,
        answers: general('Indeed', 7),
      }),
      applicant('Jasmine Torres', '+63 917 555 0117', {
        status: 'active',
        stageId: 'applied',
        appliedDaysAgo: 1,
        answers: general('Job fair', 14),
      }),
      applicant('Paolo Garcia', '+63 917 555 0118', {
        status: 'rejected',
        stageId: 'interview',
        appliedDaysAgo: 16,
        answers: general('Indeed', 7),
        rejectionReason: 'Not available for the night shift the account runs on.',
        interview: {
          format: 'video',
          location: '',
          note: 'We will send a Teams link.',
          durationMinutes: 30,
          status: 'booked',
          day: -7,
          hour: 11,
          slots: 2,
          interviewers: [1],
          feedback: [
            {
              interviewer: 1,
              recommendation: 'no',
              values: {
                communication: 3,
                roleSkills: 2,
                teamwork: 3,
                values: 4,
                strengths: 'Friendly and eager.',
                concerns: 'Cannot commit to nights, which is the whole schedule for this account.',
              },
            },
          ],
        },
      }),
    ],
  },
  {
    slug: 'medical-billing-specialist-demo03',
    title: 'Medical Billing Specialist',
    summary: 'Keep claims clean and cash flowing on a flexible, fully remote contract.',
    description: `Our Revenue Cycle team is looking for an experienced billing specialist to work claim denials and aged A/R for a growing book of provider groups. This is a six-month contract with a strong chance of extension.

What you will do
- Work denials and rejections in the clearinghouse and payer portals
- Correct and resubmit claims, and write appeals where they are warranted
- Post payments and reconcile EOBs and ERAs
- Flag trends in denials to the coding and front-desk teams

What you bring
- Two or more years of professional medical billing
- Working knowledge of CPT, ICD-10 and HCPCS
- Experience with Medicare, Medicaid and major commercial payers
- A quiet workspace and a reliable internet connection

Hours are flexible within US business hours, 30–40 a week.`,
    location: 'Remote — United States',
    workplace: 'remote',
    employmentType: 'contract',
    salaryMin: 28,
    salaryMax: 34,
    salaryCurrency: 'USD',
    salaryPeriod: 'hour',
    status: 'open',
    resumeRequired: true,
    department: 'Revenue Cycle',
    timeZone: 'America/Detroit',
    stages: DEFAULT_STAGES,
    applicationForm: GENERAL_APPLICATION,
    scorecardForm: STANDARD_SCORECARD,
    openedDaysAgo: 9,
    closesInDays: 5,
    applicants: [
      applicant('Linda Hoffman', '+1 312 555 0121', {
        status: 'active',
        stageId: 'interview',
        appliedDaysAgo: 8,
        answers: general(
          'LinkedIn',
          7,
          'Twelve years in billing, most of them on denials. I like the detective work.',
        ),
        interview: {
          format: 'phone',
          location: '+1 616 555 0199',
          note: 'We will call you from this number at the time you pick.',
          durationMinutes: 30,
          status: 'booked',
          day: 0,
          hour: 11,
          slots: 3,
          interviewers: [0],
        },
      }),
      applicant('Marcus Greene', '+1 404 555 0122', {
        status: 'active',
        stageId: 'screening',
        appliedDaysAgo: 5,
        answers: general('Indeed', 14),
      }),
      applicant('Tanya Petrova', '+1 718 555 0123', {
        status: 'active',
        stageId: 'applied',
        appliedDaysAgo: 3,
        answers: general('Our careers page', 7),
      }),
      applicant('Chris Donnelly', '+1 614 555 0124', {
        status: 'active',
        stageId: 'applied',
        appliedDaysAgo: 1,
        answers: general('Other', 21),
      }),
      applicant('Hannah Lee', '+1 206 555 0125', {
        status: 'rejected',
        stageId: 'applied',
        appliedDaysAgo: 7,
        answers: general('Indeed', 7),
        rejectionReason: 'Coding experience only; this role is billing and denials.',
      }),
    ],
  },
  {
    slug: 'senior-data-engineer-demo04',
    title: 'Senior Data Engineer',
    summary: 'Build the claims and clinical data platform that our care teams rely on every day.',
    description: `We are a small data team with a big remit: every care manager, actuary and quality analyst in the company runs on the pipelines we build. We are looking for a senior engineer to own our claims ingestion and help us move to an event-driven platform.

What you will do
- Design and run pipelines that ingest 837 and 835 files, eligibility and clinical feeds
- Model claims and member data in Postgres and our warehouse for analysts and the portal
- Raise the bar on testing, observability and data quality
- Mentor two mid-level engineers

What you bring
- Six or more years of data or backend engineering
- Strong SQL and Python or TypeScript
- Experience with healthcare data (X12, HL7 or FHIR) is a big plus
- A habit of writing things down

Fully remote within US time zones, with a team week in Grand Rapids twice a year.`,
    location: 'Remote — United States',
    workplace: 'remote',
    employmentType: 'full_time',
    salaryMin: 145000,
    salaryMax: 170000,
    salaryCurrency: 'USD',
    salaryPeriod: 'year',
    status: 'open',
    resumeRequired: true,
    department: 'Information Technology',
    timeZone: 'America/Detroit',
    stages: ENGINEERING_STAGES,
    applicationForm: GENERAL_APPLICATION,
    scorecardForm: TECHNICAL_SCORECARD,
    openedDaysAgo: 42,
    closesInDays: null,
    applicants: [
      applicant('Nikhil Sharma', '+1 415 555 0131', {
        status: 'active',
        stageId: 'panel',
        appliedDaysAgo: 38,
        answers: general('Referral from an employee', 30, '', 'https://github.com/example-nikhil'),
        notes: [
          { daysAgo: 14, body: 'Technical round was the strongest we have seen this cycle.' },
          { daysAgo: 2, body: 'Panel moved to next week at his request — travelling.' },
        ],
        interview: {
          format: 'video',
          location: '',
          note: 'Meet the wider data team. Informal — no preparation needed.',
          durationMinutes: 60,
          status: 'booked',
          day: 6,
          hour: 13,
          slots: 3,
          interviewers: [0, 1],
        },
      }),
      applicant('Olivia Bennett', '+1 512 555 0132', {
        status: 'active',
        stageId: 'technical',
        appliedDaysAgo: 21,
        answers: general('LinkedIn', 45, '', 'https://www.linkedin.com/in/example-olivia-bennett'),
        interview: {
          format: 'video',
          location: '',
          note: 'Two engineers, 90 minutes: a data-modelling discussion and a pipeline design.',
          durationMinutes: 90,
          status: 'booked',
          day: -3,
          hour: 14,
          slots: 3,
          interviewers: [0, 1],
          feedback: [
            {
              interviewer: 0,
              recommendation: 'yes',
              values: {
                problemSolving: 4,
                systemDesign: 4,
                dataModeling: 5,
                communication: 4,
                notes:
                  'Modelled claim adjustments as an append-only ledger without prompting. Design was sound; light on observability.',
              },
            },
          ],
        },
      }),
      applicant('Ethan Park', '+1 646 555 0133', {
        status: 'active',
        stageId: 'screening',
        appliedDaysAgo: 9,
        answers: general('Our careers page', 60),
      }),
      applicant('Grace Adeyemi', '+1 713 555 0134', {
        status: 'active',
        stageId: 'applied',
        appliedDaysAgo: 3,
        answers: general(
          'LinkedIn',
          30,
          'Four years on FHIR integrations at a payer; I want to go deeper on the platform side.',
        ),
      }),
      applicant('Lucas Moreau', '+1 303 555 0135', {
        status: 'rejected',
        stageId: 'technical',
        appliedDaysAgo: 33,
        answers: general('Indeed', 14),
        rejectionReason: 'Strong on tooling, but the design round fell short of the senior bar.',
        interview: {
          format: 'video',
          location: '',
          note: 'Two engineers, 90 minutes.',
          durationMinutes: 90,
          status: 'booked',
          day: -20,
          hour: 11,
          slots: 2,
          interviewers: [0, 1],
          feedback: [
            {
              interviewer: 0,
              recommendation: 'no',
              values: {
                problemSolving: 3,
                systemDesign: 2,
                dataModeling: 3,
                communication: 3,
                notes:
                  'Reached for a vendor tool for every problem; struggled to reason about idempotent reprocessing.',
              },
            },
            {
              interviewer: 1,
              recommendation: 'strong_no',
              values: {
                problemSolving: 2,
                systemDesign: 2,
                dataModeling: 2,
                communication: 3,
                notes: 'Could not model a claim with multiple adjustments.',
              },
            },
          ],
        },
      }),
      applicant('Zoe Fischer', '+1 971 555 0136', {
        status: 'withdrawn',
        stageId: 'screening',
        appliedDaysAgo: 25,
        answers: general('LinkedIn', 30),
      }),
    ],
  },
  {
    slug: 'provider-network-coordinator-demo05',
    title: 'Provider Network Coordinator',
    summary: 'Keep our provider directory accurate and our providers happy.',
    description: `Applications for this role are closed while we finish interviewing.

The Provider Network team recruits, credentials and supports the physicians and facilities our members see. As coordinator you will keep provider records accurate, run the credentialing calendar and be the first point of contact for provider questions.

What you bring
- Two years in provider relations, credentialing or a medical office
- Meticulous attention to detail
- Experience with CAQH is a plus`,
    location: 'Grand Rapids, MI',
    workplace: 'onsite',
    employmentType: 'full_time',
    salaryMin: 48000,
    salaryMax: 56000,
    salaryCurrency: 'USD',
    salaryPeriod: 'year',
    status: 'closed',
    resumeRequired: true,
    department: 'Provider Network',
    timeZone: 'America/Detroit',
    stages: DEFAULT_STAGES,
    applicationForm: GENERAL_APPLICATION,
    scorecardForm: STANDARD_SCORECARD,
    openedDaysAgo: 60,
    closesInDays: -14,
    applicants: [
      applicant('Rachel Kim', '+1 616 555 0141', {
        status: 'active',
        stageId: 'offer',
        appliedDaysAgo: 52,
        answers: general('Referral from an employee', 14),
        interview: {
          format: 'onsite',
          location: GRAND_RAPIDS_OFFICE,
          note: 'Meet the Provider Network team.',
          durationMinutes: 60,
          status: 'booked',
          day: -30,
          hour: 13,
          slots: 3,
          interviewers: [0],
          feedback: [
            {
              interviewer: 0,
              recommendation: 'strong_yes',
              values: {
                communication: 5,
                roleSkills: 5,
                teamwork: 4,
                values: 4,
                strengths: 'Ran CAQH for a 40-provider group single-handed. Exactly the profile.',
              },
            },
          ],
        },
      }),
      applicant('Tom Reilly', '+1 616 555 0142', {
        status: 'active',
        stageId: 'interview',
        appliedDaysAgo: 48,
        answers: general('Indeed', 21),
        notes: [{ daysAgo: 20, body: 'Holding as backup while the offer to Rachel is out.' }],
      }),
      applicant('Megan Foster', '+1 616 555 0143', {
        status: 'rejected',
        stageId: 'screening',
        appliedDaysAgo: 55,
        answers: general('Job fair', 14),
        rejectionReason: 'Looking for a remote role; this one is on site five days.',
      }),
      applicant('Carlos Rivera', '+1 616 555 0144', {
        status: 'rejected',
        stageId: 'applied',
        appliedDaysAgo: 50,
        answers: general('Other', 7),
      }),
    ],
  },
  {
    slug: 'quality-compliance-analyst-demo06',
    title: 'Quality & Compliance Analyst',
    summary: 'Help us prepare for HEDIS season and keep our NCQA accreditation spotless.',
    description: `Draft — waiting on the compensation band from Finance before this goes live.

The Quality & Compliance team runs our HEDIS reporting, NCQA accreditation and internal audits. The analyst will own chart-chase logistics and the audit evidence library.`,
    location: 'Grand Rapids, MI',
    workplace: 'hybrid',
    employmentType: 'full_time',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'USD',
    salaryPeriod: 'year',
    status: 'draft',
    resumeRequired: true,
    department: 'Quality & Compliance',
    timeZone: 'America/Detroit',
    stages: DEFAULT_STAGES,
    applicationForm: GENERAL_APPLICATION,
    scorecardForm: STANDARD_SCORECARD,
    openedDaysAgo: null,
    closesInDays: null,
    applicants: [],
  },
  {
    slug: 'clinical-operations-intern-demo07',
    title: 'Clinical Operations Intern — Summer',
    summary: 'A paid 10-week internship for nursing and public health students.',
    description: `Our summer internship places students with the Clinical Operations team for ten weeks of real project work: utilization reviews, member outreach campaigns and process improvement.

Open to students entering their final year of a nursing, public health or health administration program.`,
    location: 'Grand Rapids, MI',
    workplace: 'onsite',
    employmentType: 'internship',
    salaryMin: 20,
    salaryMax: 20,
    salaryCurrency: 'USD',
    salaryPeriod: 'hour',
    status: 'archived',
    resumeRequired: false,
    department: 'Clinical Operations',
    timeZone: 'America/Detroit',
    stages: DEFAULT_STAGES,
    applicationForm: GENERAL_APPLICATION,
    scorecardForm: null,
    openedDaysAgo: 150,
    closesInDays: -110,
    applicants: [
      applicant('Abigail Turner', '+1 616 555 0151', {
        status: 'hired',
        stageId: 'offer',
        appliedDaysAgo: 140,
        answers: general('Job fair', 30),
      }),
      applicant('Noah Jensen', '+1 616 555 0152', {
        status: 'rejected',
        stageId: 'interview',
        appliedDaysAgo: 138,
        answers: general('Our careers page', 30),
        rejectionReason: 'We filled the one place this summer.',
      }),
      applicant('Isabella Cruz', '+1 616 555 0153', {
        status: 'rejected',
        stageId: 'screening',
        appliedDaysAgo: 135,
        answers: general('Referral from an employee', 30),
        rejectionReason: 'We filled the one place this summer.',
      }),
    ],
  },
]
