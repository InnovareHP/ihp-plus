import { z } from 'zod'
import { pageQueryFields, type Paginated } from '@/lib/pagination'
// A posting's extra questions are a requests form of kind "application", so the field shape is
// the one the form builder already speaks.
import { answerSchemaOf, type FormField, type RequestValues } from '@/features/requests/schema'
import { descriptionText } from './utils/description-html'
import { isTimeZone } from './utils/interview-time'

export const POSTING_STATUSES = ['draft', 'open', 'closed', 'archived'] as const
export const POSTING_STATUS_FILTERS = ['current', ...POSTING_STATUSES] as const
export const WORKPLACES = ['onsite', 'hybrid', 'remote'] as const
export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'internship',
  'temporary',
] as const

export type PostingStatus = (typeof POSTING_STATUSES)[number]
export type PostingStatusFilter = (typeof POSTING_STATUS_FILTERS)[number]
export type Workplace = (typeof WORKPLACES)[number]
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const SALARY_PERIODS = ['year', 'month', 'hour'] as const
export type SalaryPeriod = (typeof SALARY_PERIODS)[number]

export const SALARY_PERIOD_LABELS: Record<SalaryPeriod, string> = {
  year: 'a year',
  month: 'a month',
  hour: 'an hour',
}

export const POSTING_STATUS_LABELS: Record<PostingStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived',
}

export const POSTING_STATUS_COLORS: Record<PostingStatus, string> = {
  draft: 'gray',
  open: 'green',
  closed: 'yellow',
  archived: 'gray',
}

export const POSTING_STATUS_FILTER_OPTIONS = [
  { value: 'current', label: 'Not archived' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
] as const satisfies readonly { value: PostingStatusFilter; label: string }[]

export const WORKPLACE_LABELS: Record<Workplace, string> = {
  onsite: 'On site',
  hybrid: 'Hybrid',
  remote: 'Remote',
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  internship: 'Internship',
  temporary: 'Temporary',
}

export const MAX_STAGES = 12
// The stage every new application lands in; it cannot be removed or moved off the top.
export const ENTRY_STAGE_ID = 'applied'

export const stageSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z
    .string()
    .trim()
    .min(1, 'Name the stage.')
    .max(40, 'Keep a stage name under 40 characters.'),
  message: z.string().trim().max(2000).default(''),
})

export const stagesSchema = z
  .array(stageSchema)
  .min(1, 'A posting needs at least one stage.')
  .max(MAX_STAGES, `A posting can have at most ${MAX_STAGES} stages.`)
  .refine((stages) => stages[0]?.id === ENTRY_STAGE_ID, {
    message: 'The first stage is where applications land, so it stays first.',
  })
  .refine((stages) => new Set(stages.map((stage) => stage.id)).size === stages.length, {
    message: 'Two stages share an id.',
  })
  .refine(
    (stages) =>
      new Set(stages.map((stage) => stage.name.trim().toLowerCase())).size === stages.length,
    { message: 'Give every stage a different name.' },
  )

export type Stage = z.infer<typeof stageSchema>
export type StageInput = z.input<typeof stageSchema>

export const DEFAULT_STAGES: readonly Stage[] = [
  { id: ENTRY_STAGE_ID, name: 'Applied', message: '' },
  { id: 'screening', name: 'Screening', message: '' },
  {
    id: 'interview',
    name: 'Interview',
    message:
      'Thank you for applying. We would like to meet you — we will be in touch shortly to find a time that suits you.',
  },
  { id: 'offer', name: 'Offer', message: '' },
]

export const DEFAULT_REJECTION_MESSAGE =
  'Thank you for your interest and for the time you put into applying. We have decided not to move forward with your application for this role, and we wish you the best in your search.'

export const DEFAULT_TIME_ZONE = 'Asia/Manila'

export const hiringSettingsSchema = z.object({
  hrTeamId: z.string().trim().default(''),
  defaultStages: stagesSchema,
  rejectionMessage: z
    .string()
    .trim()
    .min(1, 'Write the message a rejected applicant receives.')
    .max(2000),
  timeZone: z
    .string()
    .trim()
    .refine(isTimeZone, 'Pick a time zone from the list.')
    .default(DEFAULT_TIME_ZONE),
})

export type HiringSettingsInput = z.input<typeof hiringSettingsSchema>
export type HiringSettingsValues = z.infer<typeof hiringSettingsSchema>

export interface HiringSettings {
  hrTeamId: string | undefined
  hrTeamName: string | undefined
  defaultStages: Stage[]
  rejectionMessage: string
  canEditHrTeam: boolean
  timeZone: string
}

const optionalWhole = z.union([z.number().int().min(0).max(100_000_000), z.literal('')]).default('')

export const postingDraftSchema = z
  .object({
    postingId: z.string().optional(),
    title: z.string().trim().min(3, 'Give the job a title.').max(120),
    summary: z.string().trim().max(200, 'Keep the summary to one line.').default(''),
    description: z
      .string()
      .trim()
      .max(40_000, 'Shorten the description.')
      .refine(
        (value) => descriptionText(value).length >= 20,
        'Describe the role, so an applicant knows what they are applying for.',
      ),
    location: z.string().trim().max(120).default(''),
    workplace: z.enum(WORKPLACES),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    salaryMin: optionalWhole,
    salaryMax: optionalWhole,
    salaryCurrency: z.string().trim().length(3, 'Use a three-letter currency code.').default('USD'),
    salaryPeriod: z.enum(SALARY_PERIODS).default('year'),
    resumeRequired: z.boolean().default(true),
    stages: stagesSchema,
    applicationFormId: z.string().trim().default(''),
    scorecardFormId: z.string().trim().default(''),
    teamId: z.string().trim().default(''),
    // An ISO date; empty keeps the posting open until someone closes it.
    closesAt: z.string().trim().default(''),
  })
  .refine(
    (draft) =>
      draft.salaryMin === '' || draft.salaryMax === '' || draft.salaryMin <= draft.salaryMax,
    { message: 'The lowest pay cannot be above the highest.', path: ['salaryMax'] },
  )

export type PostingDraftInput = z.input<typeof postingDraftSchema>
export type PostingDraftValues = z.infer<typeof postingDraftSchema>

export interface PostingRow {
  id: string
  slug: string
  title: string
  summary: string
  description: string
  location: string
  workplace: Workplace
  employmentType: EmploymentType
  salaryMin: number | undefined
  salaryMax: number | undefined
  salaryCurrency: string
  salaryPeriod: SalaryPeriod
  status: PostingStatus
  resumeRequired: boolean
  stages: Stage[]
  applicationFormId: string | undefined
  applicationFormName: string | undefined
  applicationFields: FormField[]
  scorecardFormId: string | undefined
  scorecardFormName: string | undefined
  teamId: string | undefined
  teamName: string | undefined
  openedAt: string | undefined
  closesAt: string | undefined
  createdAt: string
  updatedAt: string
  applicantCount: number
  activeCount: number
  stageCounts: Record<string, number>
}

export type PostingsPage = Paginated<PostingRow>

export const postingQuerySchema = z.object({
  search: z.string().trim().max(100).catch('').default(''),
  status: z.enum(POSTING_STATUS_FILTERS).catch('current').default('current'),
  teamIds: z.array(z.string().trim().min(1)).max(50).catch([]).default([]),
  ...pageQueryFields,
})

export type PostingQuery = z.infer<typeof postingQuerySchema>

export const DEFAULT_POSTING_QUERY: PostingQuery = postingQuerySchema.parse({})

export function isFilteredPostingQuery(query: PostingQuery) {
  return query.search.length > 0 || query.status !== 'current' || query.teamIds.length > 0
}

// An open posting is the public face of the company, so it must be complete before it goes up.
export function publishBlockers(posting: { stages: readonly unknown[]; description: string }) {
  const blockers: string[] = []
  if (descriptionText(posting.description).length < 20) blockers.push('Describe the role.')
  if (posting.stages.length === 0) blockers.push('Add at least one stage.')
  return blockers
}

export function salaryLabel(posting: {
  salaryMin: number | undefined
  salaryMax: number | undefined
  salaryCurrency: string
  salaryPeriod: SalaryPeriod
}) {
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: posting.salaryCurrency,
    maximumFractionDigits: 0,
  })
  const { salaryMin: min, salaryMax: max } = posting
  const per = SALARY_PERIOD_LABELS[posting.salaryPeriod]
  if (min !== undefined && max !== undefined) {
    const range = min === max ? money.format(min) : `${money.format(min)} – ${money.format(max)}`
    return `${range} ${per}`
  }
  if (min !== undefined) return `From ${money.format(min)} ${per}`
  if (max !== undefined) return `Up to ${money.format(max)} ${per}`
  return undefined
}

export const APPLICATION_STATUSES = ['active', 'hired', 'rejected', 'withdrawn'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  active: 'In progress',
  hired: 'Hired',
  rejected: 'Not moving forward',
  withdrawn: 'Withdrawn',
}

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  active: 'blue',
  hired: 'green',
  rejected: 'gray',
  withdrawn: 'gray',
}

// The resume sits beside the form's own file questions, under a name no generated id can take.
export const RESUME_FIELD_ID = 'resume'

export const CONSENT_REQUIRED =
  'Tick the box so we can keep your details while we review your application.'

export function contactSchemaOf(resumeRequired: boolean) {
  return z.object({
    fullName: z.string().trim().min(2, 'Enter your full name.').max(120),
    email: z.email('Enter an email address we can reach you at.').max(200),
    phone: z.string().trim().max(40, 'Keep the phone number under 40 characters.').default(''),
    // The id of a resume already uploaded; the server checks it belongs to this posting.
    resumeId: resumeRequired
      ? z.string().trim().min(1, 'Attach your resume.').max(200)
      : z.string().trim().max(200).default(''),
    consent: z.boolean().refine((value) => value, { message: CONSENT_REQUIRED }),
    // A field people never see; anything typed into it came from a bot filling every input.
    website: z.string().max(200).default(''),
  })
}

/** The whole application: the contact block plus the posting's own questions, keyed by id. */
export function applicationSchemaOf(posting: {
  resumeRequired: boolean
  applicationFields: readonly FormField[]
}) {
  return answerSchemaOf(posting.applicationFields).extend({
    contact: contactSchemaOf(posting.resumeRequired),
  })
}

export type ContactValues = z.infer<ReturnType<typeof contactSchemaOf>>

export interface ApplicationSubmission {
  slug: string
  contact: ContactValues
  answers: RequestValues
}

/** A posting as the public sees it: nothing about the pipeline or who applied. */
export interface PublicPosting {
  slug: string
  title: string
  summary: string
  description: string
  location: string
  workplace: Workplace
  employmentType: EmploymentType
  salaryMin: number | undefined
  salaryMax: number | undefined
  salaryCurrency: string
  salaryPeriod: SalaryPeriod
  teamName: string | undefined
  openedAt: string | undefined
  closesAt: string | undefined
  resumeRequired: boolean
  applicationFields: FormField[]
  /** False once it is closed or past its closing date; the page still renders so links do not 404. */
  isOpen: boolean
}

export interface CareersPage {
  organizationName: string
  postings: PublicPosting[]
}

/** What an applicant reads through their status link. */
export interface ApplicationStatusView {
  id: string
  firstName: string
  postingTitle: string
  postingSlug: string
  organizationName: string
  status: ApplicationStatus
  stageName: string
  appliedAt: string
  updatedAt: string
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string }

export const APPLICATION_STATUS_FILTERS = [...APPLICATION_STATUSES, 'all'] as const
export type ApplicationStatusFilter = (typeof APPLICATION_STATUS_FILTERS)[number]

export const APPLICATION_STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'In progress' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Not moving forward' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'all', label: 'Everyone' },
] as const satisfies readonly { value: ApplicationStatusFilter; label: string }[]

export interface ApplicationSummary {
  id: string
  postingId: string
  postingTitle: string
  fullName: string
  email: string
  phone: string
  status: ApplicationStatus
  stageId: string
  stageName: string
  stageChangedAt: string
  createdAt: string
  updatedAt: string
  hasResume: boolean
}

export interface ApplicationFile {
  id: string
  fieldId: string
  fileName: string
  contentType: string
  fileSize: number
}

export interface ApplicationNote {
  id: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
  isMine: boolean
}

export interface ApplicationEventRow {
  id: string
  label: string
  actorName: string | undefined
  detail: string | undefined
  createdAt: string
}

export interface ApplicationDetail {
  summary: ApplicationSummary
  fields: FormField[]
  values: RequestValues
  files: ApplicationFile[]
  notes: ApplicationNote[]
  events: ApplicationEventRow[]
  stages: Stage[]
  rejectionReason: string | undefined
  postingSlug: string
  joined: boolean
  /** Set only while the invitation is pending and its link still works. */
  invitationExpiresAt: string | undefined
  postingTeamId: string | undefined
  interviews: InterviewRow[]
  scorecards: ScorecardRow[]
  /** Newest first; only the newest can still be answered. */
  offers: OfferRow[]
}

export type ApplicationsPage = Paginated<ApplicationSummary>

export const applicationQuerySchema = z.object({
  search: z.string().trim().max(100).catch('').default(''),
  status: z.enum(APPLICATION_STATUS_FILTERS).catch('active').default('active'),
  stageId: z.string().trim().max(60).catch('').default(''),
  postingId: z.string().trim().max(60).catch('').default(''),
  ...pageQueryFields,
})

export type ApplicationQuery = z.infer<typeof applicationQuerySchema>

export const DEFAULT_APPLICATION_QUERY: ApplicationQuery = applicationQuerySchema.parse({})

export function isFilteredApplicationQuery(query: ApplicationQuery) {
  return (
    query.search.length > 0 ||
    query.status !== 'active' ||
    query.stageId.length > 0 ||
    query.postingId.length > 0
  )
}

export const moveSchema = z.object({
  applicationId: z.string().min(1),
  stageId: z.string().trim().min(1, 'Pick a stage.'),
  sendEmail: z.boolean().default(false),
  message: z.string().trim().max(2000).default(''),
})

export type MoveValues = z.infer<typeof moveSchema>
export type MoveInput = z.input<typeof moveSchema>

export const rejectSchema = z
  .object({
    applicationId: z.string().min(1),
    reason: z.string().trim().max(1000).default(''),
    sendEmail: z.boolean().default(true),
    message: z.string().trim().max(2000).default(''),
  })
  // An email with nothing in it would read as a mistake, so it is refused on both sides.
  .refine((values) => !values.sendEmail || values.message.length > 0, {
    message: 'Write the message they will receive, or choose not to email them.',
    path: ['message'],
  })

export type RejectValues = z.infer<typeof rejectSchema>
export type RejectInput = z.input<typeof rejectSchema>

export const noteSchema = z.object({
  applicationId: z.string().min(1),
  body: z.string().trim().min(1, 'Write the note first.').max(4000),
})

export type NoteValues = z.infer<typeof noteSchema>

// How long someone has sat where they are, which is what a stuck pipeline shows up as.
export function daysSince(iso: string, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)))
}

export const INTERVIEW_FORMATS = ['video', 'onsite', 'phone'] as const
export const INTERVIEW_STATUSES = [
  'offered',
  'booked',
  'reschedule_requested',
  'cancelled',
] as const
export const INTERVIEW_DURATIONS = [15, 30, 45, 60, 90] as const

export type InterviewFormat = (typeof INTERVIEW_FORMATS)[number]
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number]

export const INTERVIEW_FORMAT_LABELS: Record<InterviewFormat, string> = {
  video: 'Video call',
  onsite: 'In person',
  phone: 'Phone call',
}

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  offered: 'Waiting for them to pick a time',
  booked: 'Booked',
  reschedule_requested: 'Needs other times',
  cancelled: 'Cancelled',
}

export const INTERVIEW_STATUS_COLORS: Record<InterviewStatus, string> = {
  offered: 'blue',
  booked: 'green',
  reschedule_requested: 'yellow',
  cancelled: 'gray',
}

export const MAX_INTERVIEW_SLOTS = 8

export interface InterviewSlot {
  id: string
  start: string
  end: string
}

export interface Interviewer {
  userId: string
  name: string
  email: string
}

export interface InterviewRow {
  id: string
  applicationId: string
  format: InterviewFormat
  location: string
  note: string
  durationMinutes: number
  interviewers: Interviewer[]
  status: InterviewStatus
  slots: InterviewSlot[]
  bookedStart: string | undefined
  bookedEnd: string | undefined
  applicantTimeZone: string | undefined
  joinUrl: string | undefined
  inCalendar: boolean
  createdAt: string
}

/** A time as HR types it: a date and a clock reading in the organization's zone. */
export const slotInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a time.'),
})

export const offerInterviewSchema = z
  .object({
    applicationId: z.string().min(1),
    format: z.enum(INTERVIEW_FORMATS),
    location: z.string().trim().max(300).default(''),
    note: z.string().trim().max(1000).default(''),
    durationMinutes: z.coerce.number().int().min(15).max(240),
    interviewerIds: z.array(z.string().min(1)).min(1, 'Pick at least one interviewer.').max(10),
    slots: z
      .array(slotInputSchema)
      .min(1, 'Offer at least one time.')
      .max(MAX_INTERVIEW_SLOTS, `Offer at most ${MAX_INTERVIEW_SLOTS} times.`),
  })
  // Without Teams a video call needs a link, and an in-person one an address.
  .refine((values) => values.format === 'phone' || values.format === 'video' || values.location, {
    message: 'Say where the interview happens.',
    path: ['location'],
  })

export type OfferInterviewInput = z.input<typeof offerInterviewSchema>
export type OfferInterviewValues = z.infer<typeof offerInterviewSchema>

/** The same offer as it crosses the wire: every time already resolved to an instant. */
export const offerInterviewRequestSchema = z.object({
  applicationId: z.string().min(1),
  format: z.enum(INTERVIEW_FORMATS),
  location: z.string().trim().max(300).default(''),
  note: z.string().trim().max(1000).default(''),
  durationMinutes: z.number().int().min(15).max(240),
  interviewerIds: z.array(z.string().min(1)).min(1, 'Pick at least one interviewer.').max(10),
  starts: z
    .array(z.iso.datetime())
    .min(1, 'Offer at least one time.')
    .max(MAX_INTERVIEW_SLOTS, `Offer at most ${MAX_INTERVIEW_SLOTS} times.`),
})

export type OfferInterviewRequest = z.infer<typeof offerInterviewRequestSchema>

/** What the applicant sees of an interview offer on their status page. */
export interface InterviewOffer {
  id: string
  status: InterviewStatus
  format: InterviewFormat
  location: string
  note: string
  durationMinutes: number
  slots: InterviewSlot[]
  bookedStart: string | undefined
  bookedEnd: string | undefined
  joinUrl: string | undefined
}

export const bookSlotSchema = z.object({
  applicationId: z.string().min(1).max(100),
  signature: z.string().min(1).max(200),
  interviewId: z.string().min(1).max(100),
  slotId: z.string().min(1).max(100),
  timeZone: z.string().min(1).max(64),
})

export type BookSlotValues = z.infer<typeof bookSlotSchema>

export const RECOMMENDATIONS = ['strong_yes', 'yes', 'no', 'strong_no'] as const
export type Recommendation = (typeof RECOMMENDATIONS)[number]

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_yes: 'Strong yes',
  yes: 'Yes',
  no: 'No',
  strong_no: 'Strong no',
}

export const RECOMMENDATION_COLORS: Record<Recommendation, string> = {
  strong_yes: 'green',
  yes: 'teal',
  no: 'orange',
  strong_no: 'red',
}

export interface ScorecardRow {
  interviewId: string
  interviewerId: string
  interviewerName: string
  recommendation: Recommendation
  fields: FormField[]
  values: RequestValues
  updatedAt: string
}

export interface InterviewerView {
  interview: InterviewRow
  applicant: ApplicationSummary
  applicationFields: FormField[]
  applicationValues: RequestValues
  files: ApplicationFile[]
  scorecardFields: FormField[]
  mine: ScorecardRow | undefined
  timeZone: string
  canScore: boolean
}

export const RECOMMENDATION_REQUIRED = 'Give your overall recommendation.'

/** The scorecard as a form: the posting's own questions beside the one fixed verdict. */
export function scorecardSchemaOf(fields: readonly FormField[]) {
  return answerSchemaOf(fields).extend({
    recommendation: z.enum(RECOMMENDATIONS, RECOMMENDATION_REQUIRED),
  })
}

export const OFFER_STATUSES = ['sent', 'accepted', 'declined'] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  sent: 'Waiting for their answer',
  accepted: 'Accepted',
  declined: 'Declined',
}

export const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  sent: 'blue',
  accepted: 'green',
  declined: 'orange',
}

export interface OfferRow {
  id: string
  status: OfferStatus
  message: string
  fileName: string | undefined
  fileSize: number | undefined
  declineReason: string | undefined
  createdAt: string
  respondedAt: string | undefined
  createdByName: string
}

// Custom stages get random ids, so the offer stage is also recognised by what HR named it.
export function isOfferStage(stage: Pick<Stage, 'id' | 'name'> | undefined) {
  return Boolean(stage && (stage.id === 'offer' || /\boffers?\b/i.test(stage.name)))
}

export const DEFAULT_OFFER_MESSAGE =
  'We are delighted to offer you this role. The attached letter sets out the terms — please read it, then accept or decline the offer from this page.'

export const sendOfferSchema = z.object({
  applicationId: z.string().min(1),
  message: z
    .string()
    .trim()
    .min(1, 'Write the message they will read with the offer.')
    .max(4000, 'Keep the message under 4,000 characters.'),
  // The letter itself travels beside these values as a File, which zod does not see.
})

export type SendOfferInput = z.input<typeof sendOfferSchema>
export type SendOfferValues = z.infer<typeof sendOfferSchema>

// An offer letter is something to sign and keep, so only document formats are taken.
export const OFFER_LETTER_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export const OFFER_LETTER_ACCEPT = OFFER_LETTER_TYPES.join(',')

const OFFER_LETTER_MAX_BYTES = 25 * 1024 * 1024

/** Why this file cannot be an offer letter, or undefined when it can. */
export function offerLetterProblem(file: { size: number; type: string }) {
  if (file.size === 0) return 'That file is empty.'
  if (file.size > OFFER_LETTER_MAX_BYTES) return 'The letter has to be 25 MB or smaller.'
  if (!(OFFER_LETTER_TYPES as readonly string[]).includes(file.type)) {
    return 'Attach the letter as a PDF or Word document.'
  }
  return undefined
}

/** The modal's form: the offer plus the letter, which the server re-checks on arrival. */
export const sendOfferFormSchema = sendOfferSchema.extend({
  letter: z
    .custom<File | null>((value) => value === null || value instanceof File)
    .superRefine((file, context) => {
      const problem = file ? offerLetterProblem(file) : undefined
      if (problem) context.addIssue({ code: 'custom', message: problem })
    })
    .default(null),
})

export type SendOfferFormInput = z.input<typeof sendOfferFormSchema>
export type SendOfferFormValues = z.infer<typeof sendOfferFormSchema>

export const DECLINE_REASON_REQUIRED = 'Tell us why, so we can do better next time.'

export const offerAnswerSchema = z
  .object({
    applicationId: z.string().min(1).max(100),
    signature: z.string().min(1).max(200),
    offerId: z.string().min(1).max(100),
    decision: z.enum(['accept', 'decline']),
    reason: z.string().trim().max(1000, 'Keep the reason under 1,000 characters.').default(''),
  })
  // A decline without a reason leaves HR nothing to improve the next offer with.
  .refine((values) => values.decision === 'accept' || values.reason.length > 0, {
    message: DECLINE_REASON_REQUIRED,
    path: ['reason'],
  })

export type OfferAnswerInput = z.input<typeof offerAnswerSchema>
export type OfferAnswerValues = z.infer<typeof offerAnswerSchema>

/** What the applicant's status page shows of an offer; never who sent it. */
export interface PublicOffer {
  id: string
  status: OfferStatus
  message: string
  fileName: string | undefined
  createdAt: string
  respondedAt: string | undefined
}
