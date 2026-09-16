import {
  EvaluationStatus,
  EvaluationStatusFilter,
  type Evaluation as EvaluationMessage,
  type EvaluationCandidate as CandidateMessage,
} from '@ihp/rpc/evaluations'
import type {
  EvaluationCandidate,
  EvaluationRow,
  EvaluationStatus as Status,
  EvaluationStatusFilter as StatusFilter,
} from '@/features/evaluations/schema'
import { fieldFromProto, fieldToProto, valuesFromProto, valuesToProto } from './requests-codec'

// The UI keeps its string unions and the wire keeps its enums; every crossing goes through
// these maps, so an UNSPECIFIED value from an older client falls back rather than throwing.
const STATUS_TO_PROTO: Record<Status, EvaluationStatus> = {
  pending: EvaluationStatus.PENDING,
  submitted: EvaluationStatus.SUBMITTED,
  cancelled: EvaluationStatus.CANCELLED,
}

const STATUS_FROM_PROTO: Record<EvaluationStatus, Status> = {
  [EvaluationStatus.UNSPECIFIED]: 'pending',
  [EvaluationStatus.PENDING]: 'pending',
  [EvaluationStatus.SUBMITTED]: 'submitted',
  [EvaluationStatus.CANCELLED]: 'cancelled',
}

const FILTER_TO_PROTO: Record<StatusFilter, EvaluationStatusFilter> = {
  all: EvaluationStatusFilter.ALL,
  pending: EvaluationStatusFilter.PENDING,
  submitted: EvaluationStatusFilter.SUBMITTED,
  cancelled: EvaluationStatusFilter.CANCELLED,
}

const FILTER_FROM_PROTO: Record<EvaluationStatusFilter, StatusFilter> = {
  [EvaluationStatusFilter.UNSPECIFIED]: 'all',
  [EvaluationStatusFilter.ALL]: 'all',
  [EvaluationStatusFilter.PENDING]: 'pending',
  [EvaluationStatusFilter.SUBMITTED]: 'submitted',
  [EvaluationStatusFilter.CANCELLED]: 'cancelled',
}

export function statusFilterToProto(status: StatusFilter) {
  return FILTER_TO_PROTO[status]
}

export function statusFilterFromProto(status: EvaluationStatusFilter) {
  return FILTER_FROM_PROTO[status]
}

export function evaluationToProto(row: EvaluationRow): EvaluationMessage {
  return {
    $typeName: 'ihp.evaluations.v1.Evaluation',
    id: row.id,
    formId: row.formId,
    formName: row.formName,
    fields: row.fields.map(fieldToProto),
    values: valuesToProto(row.fields, row.values),
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    employeeTeam: row.employeeTeam,
    employeeEmploymentStatus: row.employeeEmploymentStatus,
    evaluatorId: row.evaluatorId,
    evaluatorName: row.evaluatorName,
    status: STATUS_TO_PROTO[row.status],
    dueAt: row.dueAt,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    canFill: row.canFill,
    isMine: row.isMine,
  }
}

export function evaluationFromProto(message: EvaluationMessage): EvaluationRow {
  const fields = message.fields.map(fieldFromProto)

  return {
    id: message.id,
    formId: message.formId,
    formName: message.formName,
    fields,
    values: valuesFromProto(message.values),
    employeeId: message.employeeId,
    employeeName: message.employeeName,
    employeeTeam: message.employeeTeam,
    employeeEmploymentStatus: message.employeeEmploymentStatus,
    evaluatorId: message.evaluatorId,
    evaluatorName: message.evaluatorName,
    status: STATUS_FROM_PROTO[message.status],
    dueAt: message.dueAt,
    submittedAt: message.submittedAt,
    createdAt: message.createdAt,
    canFill: message.canFill,
    isMine: message.isMine,
  }
}

export function candidateToProto(candidate: EvaluationCandidate): CandidateMessage {
  return {
    $typeName: 'ihp.evaluations.v1.EvaluationCandidate',
    userId: candidate.userId,
    name: candidate.name,
    email: candidate.email,
    team: candidate.team,
    employmentStatus: candidate.employmentStatus,
  }
}

export function candidateFromProto(message: CandidateMessage): EvaluationCandidate {
  return {
    userId: message.userId,
    name: message.name,
    email: message.email,
    team: message.team,
    employmentStatus: message.employmentStatus,
  }
}
