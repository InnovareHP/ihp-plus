import {
  FieldType,
  FormKind,
  FormStatus,
  RequestStatus,
  RequestStatusFilter,
  type DepartmentApprovers,
  type FieldValue as FieldValueMessage,
  type FormField as FormFieldMessage,
  type RequestForm as RequestFormMessage,
  type RequestSubmission as RequestSubmissionMessage,
} from '@ihp/rpc/requests'
import type {
  DepartmentApproversRow,
  FieldType as Type,
  FieldValue,
  FormField,
  FormKind as Kind,
  FormRow,
  FormStatus as Status,
  RequestRow,
  RequestStatus as SubmissionStatus,
  RequestStatusFilter as StatusFilter,
  RequestValues,
} from '@/features/requests/schema'

// The UI keeps its string unions and the wire keeps its enums; every crossing goes through
// these maps, so an UNSPECIFIED value from an older client falls back rather than throwing.
const FIELD_TYPE_TO_PROTO: Record<Type, FieldType> = {
  text: FieldType.TEXT,
  textarea: FieldType.TEXTAREA,
  number: FieldType.NUMBER,
  date: FieldType.DATE,
  select: FieldType.SELECT,
  checkbox: FieldType.CHECKBOX,
}

const FIELD_TYPE_FROM_PROTO: Record<FieldType, Type> = {
  [FieldType.UNSPECIFIED]: 'text',
  [FieldType.TEXT]: 'text',
  [FieldType.TEXTAREA]: 'textarea',
  [FieldType.NUMBER]: 'number',
  [FieldType.DATE]: 'date',
  [FieldType.SELECT]: 'select',
  [FieldType.CHECKBOX]: 'checkbox',
}

const FORM_STATUS_TO_PROTO: Record<Status, FormStatus> = {
  draft: FormStatus.DRAFT,
  published: FormStatus.PUBLISHED,
  archived: FormStatus.ARCHIVED,
}

const FORM_STATUS_FROM_PROTO: Record<FormStatus, Status> = {
  [FormStatus.UNSPECIFIED]: 'draft',
  [FormStatus.DRAFT]: 'draft',
  [FormStatus.PUBLISHED]: 'published',
  [FormStatus.ARCHIVED]: 'archived',
}

const FORM_KIND_TO_PROTO: Record<Kind, FormKind> = {
  request: FormKind.REQUEST,
  evaluation: FormKind.EVALUATION,
}

// UNSPECIFIED reads as REQUEST: every form predating evaluations is one.
const FORM_KIND_FROM_PROTO: Record<FormKind, Kind> = {
  [FormKind.UNSPECIFIED]: 'request',
  [FormKind.REQUEST]: 'request',
  [FormKind.EVALUATION]: 'evaluation',
}

const REQUEST_STATUS_TO_PROTO: Record<SubmissionStatus, RequestStatus> = {
  pending: RequestStatus.PENDING,
  approved: RequestStatus.APPROVED,
  rejected: RequestStatus.REJECTED,
  withdrawn: RequestStatus.WITHDRAWN,
}

const REQUEST_STATUS_FROM_PROTO: Record<RequestStatus, SubmissionStatus> = {
  [RequestStatus.UNSPECIFIED]: 'pending',
  [RequestStatus.PENDING]: 'pending',
  [RequestStatus.APPROVED]: 'approved',
  [RequestStatus.REJECTED]: 'rejected',
  [RequestStatus.WITHDRAWN]: 'withdrawn',
}

const STATUS_FILTER_TO_PROTO: Record<StatusFilter, RequestStatusFilter> = {
  all: RequestStatusFilter.ALL,
  pending: RequestStatusFilter.PENDING,
  approved: RequestStatusFilter.APPROVED,
  rejected: RequestStatusFilter.REJECTED,
  withdrawn: RequestStatusFilter.WITHDRAWN,
}

const STATUS_FILTER_FROM_PROTO: Record<RequestStatusFilter, StatusFilter> = {
  [RequestStatusFilter.UNSPECIFIED]: 'all',
  [RequestStatusFilter.ALL]: 'all',
  [RequestStatusFilter.PENDING]: 'pending',
  [RequestStatusFilter.APPROVED]: 'approved',
  [RequestStatusFilter.REJECTED]: 'rejected',
  [RequestStatusFilter.WITHDRAWN]: 'withdrawn',
}

export function fieldTypeToProto(type: Type) {
  return FIELD_TYPE_TO_PROTO[type]
}

export function formStatusToProto(status: Status) {
  return FORM_STATUS_TO_PROTO[status]
}

export function formStatusFromProto(status: FormStatus) {
  return FORM_STATUS_FROM_PROTO[status]
}

// The forms list's status filter has a fourth value the stored enum does not: any status.
export function formStatusFilterToProto(status: string) {
  return status ? FORM_STATUS_TO_PROTO[status as Status] : FormStatus.UNSPECIFIED
}

export function formStatusFilterFromProto(status: FormStatus): Status | '' {
  return status === FormStatus.UNSPECIFIED ? '' : FORM_STATUS_FROM_PROTO[status]
}

export function formKindToProto(kind: Kind) {
  return FORM_KIND_TO_PROTO[kind]
}

export function formKindFromProto(kind: FormKind) {
  return FORM_KIND_FROM_PROTO[kind]
}

export function requestStatusToProto(status: SubmissionStatus) {
  return REQUEST_STATUS_TO_PROTO[status]
}

export function requestStatusFromProto(status: RequestStatus) {
  return REQUEST_STATUS_FROM_PROTO[status]
}

export function statusFilterToProto(status: StatusFilter) {
  return STATUS_FILTER_TO_PROTO[status]
}

export function statusFilterFromProto(status: RequestStatusFilter) {
  return STATUS_FILTER_FROM_PROTO[status]
}

export function fieldToProto(field: FormField): FormFieldMessage {
  return {
    $typeName: 'ihp.requests.v1.FormField',
    id: field.id,
    type: FIELD_TYPE_TO_PROTO[field.type],
    label: field.label,
    help: field.help,
    placeholder: field.placeholder,
    required: field.required,
    options: [...field.options],
    min: field.min,
    max: field.max,
  }
}

export function fieldFromProto(field: FormFieldMessage): FormField {
  return {
    id: field.id,
    type: FIELD_TYPE_FROM_PROTO[field.type],
    label: field.label,
    help: field.help,
    placeholder: field.placeholder,
    required: field.required,
    options: field.options,
    min: field.min,
    max: field.max,
  }
}

// The oneof keeps a number a number across the wire, so the field's declared type decides
// which arm carries it rather than every consumer reparsing a string.
export function valuesToProto(
  fields: readonly FormField[],
  values: RequestValues,
): FieldValueMessage[] {
  const messages: FieldValueMessage[] = []

  for (const field of fields) {
    const value = values[field.id]
    if (value === undefined) continue

    messages.push({
      $typeName: 'ihp.requests.v1.FieldValue',
      fieldId: field.id,
      value: valueArmOf(field, value),
    })
  }

  return messages
}

type ValueArm = FieldValueMessage['value']

function valueArmOf(field: FormField, value: FieldValue): ValueArm {
  switch (field.type) {
    case 'number':
      return { case: 'number', value: typeof value === 'number' ? value : Number(value) }
    case 'checkbox':
      return { case: 'boolean', value: Boolean(value) }
    case 'date':
      return { case: 'date', value: String(value) }
    default:
      return { case: 'text', value: String(value) }
  }
}

export function valuesFromProto(messages: readonly FieldValueMessage[]): RequestValues {
  const values: RequestValues = {}

  for (const message of messages) {
    if (message.value.case === undefined) continue
    values[message.fieldId] = message.value.value
  }

  return values
}

export function formToProto(form: FormRow): RequestFormMessage {
  return {
    $typeName: 'ihp.requests.v1.RequestForm',
    id: form.id,
    kind: FORM_KIND_TO_PROTO[form.kind],
    name: form.name,
    description: form.description,
    status: FORM_STATUS_TO_PROTO[form.status],
    fields: form.fields.map(fieldToProto),
    teams: form.teams.map((team) => ({
      $typeName: 'ihp.requests.v1.TeamRef' as const,
      teamId: team.id,
      name: team.name,
    })),
    submissionCount: form.submissionCount,
    updatedAt: form.updatedAt,
  }
}

export function formFromProto(form: RequestFormMessage): FormRow {
  return {
    id: form.id,
    kind: FORM_KIND_FROM_PROTO[form.kind],
    name: form.name,
    description: form.description,
    status: FORM_STATUS_FROM_PROTO[form.status],
    fields: form.fields.map(fieldFromProto),
    teams: form.teams.map((team) => ({ id: team.teamId, name: team.name })),
    submissionCount: form.submissionCount,
    updatedAt: form.updatedAt,
  }
}

export function submissionToProto(row: RequestRow): RequestSubmissionMessage {
  return {
    $typeName: 'ihp.requests.v1.RequestSubmission',
    id: row.id,
    formId: row.formId,
    formName: row.formName,
    fields: row.fields.map(fieldToProto),
    values: valuesToProto(row.fields, row.values),
    requesterId: row.requesterId,
    requesterName: row.requesterName,
    teamName: row.teamName,
    status: REQUEST_STATUS_TO_PROTO[row.status],
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt,
    canDecide: row.canDecide,
    isMine: row.isMine,
  }
}

export function submissionFromProto(message: RequestSubmissionMessage): RequestRow {
  const fields = message.fields.map(fieldFromProto)

  return {
    id: message.id,
    formId: message.formId,
    formName: message.formName,
    fields,
    values: valuesFromProto(message.values),
    requesterId: message.requesterId,
    requesterName: message.requesterName,
    teamName: message.teamName,
    status: REQUEST_STATUS_FROM_PROTO[message.status],
    decidedBy: message.decidedBy,
    decidedAt: message.decidedAt,
    decisionNote: message.decisionNote,
    createdAt: message.createdAt,
    canDecide: message.canDecide,
    isMine: message.isMine,
  }
}

export function approversToProto(row: DepartmentApproversRow): DepartmentApprovers {
  return {
    $typeName: 'ihp.requests.v1.DepartmentApprovers',
    teamId: row.teamId,
    teamName: row.teamName,
    approvers: row.approvers.map((approver) => ({
      $typeName: 'ihp.requests.v1.Approver' as const,
      userId: approver.userId,
      name: approver.name,
      email: approver.email,
    })),
  }
}

export function approversFromProto(message: DepartmentApprovers): DepartmentApproversRow {
  return {
    teamId: message.teamId,
    teamName: message.teamName,
    approvers: message.approvers.map((approver) => ({
      userId: approver.userId,
      name: approver.name,
      email: approver.email,
    })),
  }
}
