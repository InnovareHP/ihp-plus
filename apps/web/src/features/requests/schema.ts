import { z } from 'zod'

export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'checkbox'] as const
export const FORM_STATUSES = ['draft', 'published', 'archived'] as const
export const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const
export const REQUEST_STATUS_FILTERS = ['all', ...REQUEST_STATUSES] as const
export const DECISIONS = ['approved', 'rejected'] as const

export type FieldType = (typeof FIELD_TYPES)[number]
export type FormStatus = (typeof FORM_STATUSES)[number]
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

export const decisionSchema = z.object({
  submissionId: z.string().min(1),
  decision: z.enum(DECISIONS),
  note: z.string().trim().max(1000).default(''),
})

export const setApproverSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
  approver: z.boolean(),
})

export type FormField = z.infer<typeof formFieldSchema>
export type FormDraftValues = z.infer<typeof formDraftSchema>
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
export function publishBlockers(form: Pick<FormRow, 'fields' | 'teams'>) {
  const blockers: string[] = []
  if (form.fields.length === 0) blockers.push('Add at least one question.')
  if (form.teams.length === 0) blockers.push('Pick at least one department.')
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
