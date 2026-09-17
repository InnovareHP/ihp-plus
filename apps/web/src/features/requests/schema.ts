import { z } from 'zod'

export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'checkbox'] as const
export const FORM_STATUSES = ['draft', 'published', 'archived'] as const
// A request form runs the approval queue; an evaluation form is assigned to a supervisor.
export const FORM_KINDS = ['request', 'evaluation'] as const
export const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const
export const REQUEST_STATUS_FILTERS = ['all', ...REQUEST_STATUSES] as const
export const DECISIONS = ['approved', 'rejected'] as const

export type FieldType = (typeof FIELD_TYPES)[number]
export type FormStatus = (typeof FORM_STATUSES)[number]
export type FormKind = (typeof FORM_KINDS)[number]
export type RequestStatus = (typeof REQUEST_STATUSES)[number]
export type RequestStatusFilter = (typeof REQUEST_STATUS_FILTERS)[number]
export type Decision = (typeof DECISIONS)[number]

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  date: 'Date',
  select: 'Choice',
  checkbox: 'Checkbox',
}

export const FORM_STATUS_LABELS: Record<FormStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  withdrawn: 'gray',
}

export const formFieldSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(FIELD_TYPES),
    label: z.string().trim().min(1, 'Give the question a label.').max(120),
    help: z.string().trim().max(200).default(''),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1)).default([]),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine((field) => field.type !== 'select' || field.options.length > 0, {
    message: 'A choice question needs at least one option.',
    path: ['options'],
  })
  .refine((field) => field.min === undefined || field.max === undefined || field.min <= field.max, {
    message: 'The lowest value cannot be above the highest.',
    path: ['max'],
  })

export const formDraftSchema = z.object({
  formId: z.string().optional(),
  kind: z.enum(FORM_KINDS).default('request'),
  name: z.string().trim().min(2, 'Give the form a name.').max(120),
  description: z.string().trim().max(400).default(''),
  fields: z.array(formFieldSchema).max(40, 'A form can hold at most 40 questions.'),
  teamIds: z.array(z.string().min(1)),
})

export const setFormStatusSchema = z.object({
  formId: z.string().min(1),
  status: z.enum(FORM_STATUSES),
})

export const formIdSchema = z.object({ formId: z.string().min(1) })
export const submissionIdSchema = z.object({ submissionId: z.string().min(1) })

export const REJECTION_NEEDS_REASON =
  'Say why it was rejected, so the requester knows what to change.'

export const decisionSchema = z
  .object({
    submissionId: z.string().min(1),
    decision: z.enum(DECISIONS),
    note: z.string().trim().max(1000).default(''),
  })
  // A rejection with no reason is a dead end for the requester, so it is refused on both sides.
  .refine((values) => values.decision !== 'rejected' || values.note.length > 0, {
    message: REJECTION_NEEDS_REASON,
    path: ['note'],
  })

export const setApproverSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
  approver: z.boolean(),
})

export type FormField = z.infer<typeof formFieldSchema>
export type FormDraftValues = z.infer<typeof formDraftSchema>
// The schema fills defaults, so what a form holds while being typed is the input side of it.
export type FormDraftInput = z.input<typeof formDraftSchema>
export type DecisionValues = z.infer<typeof decisionSchema>
export type SetApproverValues = z.infer<typeof setApproverSchema>

export type FieldValue = string | number | boolean
export type RequestValues = Record<string, FieldValue>

export interface TeamRef {
  id: string
  name: string
}

export interface FormRow {
  id: string
  kind: FormKind
  name: string
  description: string
  status: FormStatus
  fields: FormField[]
  teams: TeamRef[]
  submissionCount: number
  updatedAt: string
}

export interface RequestRow {
  id: string
  formId: string
  formName: string
  fields: FormField[]
  values: RequestValues
  requesterId: string
  requesterName: string
  teamName: string | undefined
  status: RequestStatus
  decidedBy: string | undefined
  decidedAt: string | undefined
  decisionNote: string | undefined
  createdAt: string
  canDecide: boolean
  isMine: boolean
}

export interface DepartmentApproversRow {
  teamId: string
  teamName: string
  approvers: { userId: string; name: string; email: string }[]
}

export interface RequestsPage {
  rows: RequestRow[]
  pageInfo: {
    page: number
    pageSize: number
    total: number
    pageCount: number
    hasPrevious: boolean
    hasNext: boolean
  }
}

export interface RequestQuery {
  status: RequestStatusFilter
  search: string
  teamIds: string[]
  page: number
  pageSize: number
}

// A published form must be answerable and reachable, or it is a dead entry in the catalogue.
// Only the counts matter, so a half-typed draft is as answerable a question as a saved form.
export function publishBlockers(form: {
  kind: FormKind
  fields: readonly unknown[]
  teams: readonly unknown[]
}) {
  const blockers: string[] = []
  if (form.fields.length === 0) blockers.push('Add at least one question.')
  // An evaluation reaches people by assignment, so it is never offered to a department.
  if (form.kind === 'request' && form.teams.length === 0) {
    blockers.push('Pick at least one department.')
  }
  return blockers
}

function requiredMessage(label: string) {
  return `${label} is required.`
}

// The answer schema is built from the form's own fields, so validation follows whatever an
// admin assembled rather than a fixed shape.
export function answerSchemaOf(fields: readonly FormField[]) {
  const shape: Record<string, z.ZodType> = {}

  for (const field of fields) {
    shape[field.id] = fieldSchemaOf(field)
  }

  return z.object(shape)
}

function fieldSchemaOf(field: FormField): z.ZodType {
  switch (field.type) {
    case 'number': {
      let schema = z.number({ message: `${field.label} must be a number.` })
      if (field.min !== undefined) schema = schema.min(field.min)
      if (field.max !== undefined) schema = schema.max(field.max)
      return field.required ? schema : z.union([schema, z.literal('')])
    }

    case 'checkbox':
      return field.required
        ? z.boolean().refine((value) => value, { message: requiredMessage(field.label) })
        : z.boolean()

    case 'select': {
      const schema = z.string().refine((value) => field.options.includes(value), {
        message: `Pick one of the options for ${field.label}.`,
      })
      return field.required ? schema : z.union([schema, z.literal('')])
    }

    case 'date':
    case 'text':
    case 'textarea':
    default: {
      const schema = z.string().trim().max(4000)
      return field.required ? schema.min(1, requiredMessage(field.label)) : schema
    }
  }
}

// Empty answers to optional fields are dropped rather than stored as blanks.
export function defaultAnswersOf(fields: readonly FormField[]): Record<string, FieldValue> {
  const answers: Record<string, FieldValue> = {}
  for (const field of fields) {
    answers[field.id] = field.type === 'checkbox' ? false : ''
  }
  return answers
}

const flag = z
  .union([z.boolean(), z.literal('true'), z.literal('false')])
  .transform((value) => value === true || value === 'true')
  .catch(false)

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

/** List state for the admin forms table, filtered in the browser: the list is small. */
export const formQuerySchema = z.object({
  search: z.string().trim().max(100).catch('').default(''),
  status: z.string().trim().max(20).catch('').default(''),
  teamIds: csv,
  unplacedOnly: flag,
})

/** List state for a requester's own list. */
export const myRequestQuerySchema = z.object({
  search: z.string().trim().max(100).catch('').default(''),
  status: z.enum(REQUEST_STATUS_FILTERS).catch('all'),
})

/** List state for the approvals queue, which is paged and filtered on the server. */
export const requestQuerySchema = z.object({
  search: z.string().trim().max(100).catch('').default(''),
  status: z.enum(REQUEST_STATUS_FILTERS).catch('pending'),
  teamIds: csv,
  page: z.coerce.number().int().min(1).catch(1),
})

export type FormQuery = z.infer<typeof formQuerySchema>
export type MyRequestQuery = z.infer<typeof myRequestQuerySchema>
export type RequestListQuery = z.infer<typeof requestQuerySchema>

export const DEFAULT_FORM_QUERY: FormQuery = formQuerySchema.parse({})
export const DEFAULT_MY_REQUEST_QUERY: MyRequestQuery = myRequestQuerySchema.parse({})
export const DEFAULT_REQUEST_QUERY: RequestListQuery = requestQuerySchema.parse({})

export const REQUEST_STATUS_OPTIONS = REQUEST_STATUSES.map((status) => ({
  value: status,
  label: REQUEST_STATUS_LABELS[status],
}))

export const FORM_STATUS_OPTIONS = FORM_STATUSES.map((status) => ({
  value: status,
  label: FORM_STATUS_LABELS[status],
}))
