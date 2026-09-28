import { z } from 'zod'
import { pageQueryFields, type Paginated } from '@/lib/pagination'
// A posting's extra questions are a requests form of kind "application", so the field shape is
// the one the form builder already speaks.
import type { FormField } from '@/features/requests/schema'

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

export const hiringSettingsSchema = z.object({
  hrTeamId: z.string().trim().default(''),
  defaultStages: stagesSchema,
  rejectionMessage: z
    .string()
    .trim()
    .min(1, 'Write the message a rejected applicant receives.')
    .max(2000),
})

export type HiringSettingsInput = z.input<typeof hiringSettingsSchema>
export type HiringSettingsValues = z.infer<typeof hiringSettingsSchema>

export interface HiringSettings {
  hrTeamId: string | undefined
  hrTeamName: string | undefined
  defaultStages: Stage[]
  rejectionMessage: string
  canEditHrTeam: boolean
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
      .min(20, 'Describe the role, so an applicant knows what they are applying for.')
      .max(20_000),
    location: z.string().trim().max(120).default(''),
    workplace: z.enum(WORKPLACES),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    salaryMin: optionalWhole,
    salaryMax: optionalWhole,
    salaryCurrency: z.string().trim().length(3, 'Use a three-letter currency code.').default('USD'),
    resumeRequired: z.boolean().default(true),
    stages: stagesSchema,
    applicationFormId: z.string().trim().default(''),
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
  status: PostingStatus
  resumeRequired: boolean
  stages: Stage[]
  applicationFormId: string | undefined
  applicationFormName: string | undefined
  applicationFields: FormField[]
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
  if (posting.description.trim().length < 20) blockers.push('Describe the role.')
  if (posting.stages.length === 0) blockers.push('Add at least one stage.')
  return blockers
}

export function salaryLabel(posting: {
  salaryMin: number | undefined
  salaryMax: number | undefined
  salaryCurrency: string
}) {
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: posting.salaryCurrency,
    maximumFractionDigits: 0,
  })
  const { salaryMin: min, salaryMax: max } = posting
  if (min !== undefined && max !== undefined) {
    return min === max ? money.format(min) : `${money.format(min)} – ${money.format(max)}`
  }
  if (min !== undefined) return `From ${money.format(min)}`
  if (max !== undefined) return `Up to ${money.format(max)}`
  return undefined
}
