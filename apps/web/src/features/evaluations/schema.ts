import { z } from 'zod'
// The questions are a requests form of kind "evaluation", so the field and answer shapes are
// the ones the form builder already speaks.
import type { FormField, RequestValues } from '@/features/requests/schema'
import type { PageInfo } from '@/lib/pagination'

export const EVALUATION_STATUSES = ['pending', 'submitted', 'cancelled'] as const
export const EVALUATION_STATUS_FILTERS = ['all', ...EVALUATION_STATUSES] as const

export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number]
export type EvaluationStatusFilter = (typeof EVALUATION_STATUS_FILTERS)[number]

export const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  pending: 'To fill in',
  submitted: 'Submitted',
  cancelled: 'Cancelled',
}

export const EVALUATION_STATUS_COLORS: Record<EvaluationStatus, string> = {
  pending: 'yellow',
  submitted: 'green',
  cancelled: 'gray',
}

export const assignEvaluationsSchema = z
  .object({
    formId: z.string().min(1, 'Pick an evaluation form.'),
    evaluatorId: z.string().min(1, 'Pick who fills it in.'),
    employeeIds: z
      .array(z.string().min(1))
      .min(1, 'Pick at least one employee.')
      .max(100, 'Assign at most 100 people at a time.'),
    // Empty means no due date; the evaluator is simply asked to get to it.
    dueAt: z.string().trim().default(''),
  })
  // Self-evaluation is a different exercise with different questions, so it is refused here.
  .refine((values) => !values.employeeIds.includes(values.evaluatorId), {
    message: 'Nobody evaluates themselves — pick a different supervisor.',
    path: ['employeeIds'],
  })

export const evaluationIdSchema = z.object({ evaluationId: z.string().min(1) })

export type AssignEvaluationsValues = z.infer<typeof assignEvaluationsSchema>
export type AssignEvaluationsInput = z.input<typeof assignEvaluationsSchema>

export interface EvaluationRow {
  id: string
  formId: string
  formName: string
  fields: FormField[]
  values: RequestValues
  employeeId: string
  employeeName: string
  employeeTeam: string | undefined
  employeeEmploymentStatus: string | undefined
  evaluatorId: string
  evaluatorName: string
  status: EvaluationStatus
  dueAt: string | undefined
  submittedAt: string | undefined
  createdAt: string
  /** The evaluator of a pending evaluation, which is the only person who may answer it. */
  canFill: boolean
  isMine: boolean
}

export interface EvaluationsPage {
  rows: EvaluationRow[]
  pageInfo: PageInfo
}

export interface EvaluationCandidate {
  userId: string
  name: string
  email: string
  team: string | undefined
  employmentStatus: string | undefined
}

export interface EvaluationQuery {
  status: EvaluationStatusFilter
  search: string
  teamIds: string[]
  page: number
  pageSize: number
}

const csv = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((raw) => (typeof raw === 'string' ? raw.split(',') : (raw ?? [])))
  // Capped so a crafted URL cannot turn one filter into a thousand-branch IN clause.
  .transform((list) =>
    list
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 50),
  )

/** List state for the supervisor's own list, filtered in the browser: the list is small. */
export const myEvaluationQuerySchema = z.object({
  search: z.string().trim().max(100).catch('').default(''),
  status: z.enum(EVALUATION_STATUS_FILTERS).catch('pending'),
})

/** List state for the admin tracker, which is paged and filtered on the server. */
export const evaluationQuerySchema = z.object({
  search: z.string().trim().max(100).catch('').default(''),
  status: z.enum(EVALUATION_STATUS_FILTERS).catch('pending'),
  teamIds: csv,
  page: z.coerce.number().int().min(1).catch(1),
})

export type MyEvaluationQuery = z.infer<typeof myEvaluationQuerySchema>
export type EvaluationListQuery = z.infer<typeof evaluationQuerySchema>

export const DEFAULT_MY_EVALUATION_QUERY: MyEvaluationQuery = myEvaluationQuerySchema.parse({})
export const DEFAULT_EVALUATION_QUERY: EvaluationListQuery = evaluationQuerySchema.parse({})

export const EVALUATION_STATUS_OPTIONS = EVALUATION_STATUSES.map((status) => ({
  value: status,
  label: EVALUATION_STATUS_LABELS[status],
}))

/** Overdue is the one state worth chasing, and it is derived rather than stored. */
export function isOverdue(row: EvaluationRow, now: Date = new Date()) {
  return row.status === 'pending' && row.dueAt !== undefined && new Date(row.dueAt) < now
}
