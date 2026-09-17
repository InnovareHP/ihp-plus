'use client'

import { ConnectError } from '@ihp/rpc'
import { browserClients } from '@/rpc/browser'
import {
  candidateFromProto,
  evaluationFromProto,
  statusFilterToProto,
} from '@/rpc/evaluations-codec'
import { valuesToProto } from '@/rpc/requests-codec'
import type { FormField, RequestValues } from '@/features/requests/schema'
import type {
  AssignEvaluationsValues,
  EvaluationCandidate,
  EvaluationListQuery,
  EvaluationRow,
  EvaluationStatusFilter,
  EvaluationsPage,
} from './schema'

/**
 * ConnectError stringifies as "[permission_denied] ...", putting a machine code in front of a
 * sentence a user reads. The code stays on the ConnectError for anything that branches on it;
 * what reaches the UI is the plain message.
 */
async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw new Error(ConnectError.from(error).rawMessage)
  }
}

function required(
  evaluation: Parameters<typeof evaluationFromProto>[0] | undefined,
): EvaluationRow {
  if (!evaluation) throw new Error('The server did not return the evaluation.')
  return evaluationFromProto(evaluation)
}

export async function listMyEvaluations(status: EvaluationStatusFilter): Promise<EvaluationRow[]> {
  const response = await call(() =>
    browserClients.evaluations.listMyEvaluations({ status: statusFilterToProto(status) }),
  )
  return response.rows.map(evaluationFromProto)
}

export async function getEvaluation(evaluationId: string): Promise<EvaluationRow> {
  const response = await call(() => browserClients.evaluations.getEvaluation({ evaluationId }))
  return required(response.evaluation)
}

export async function submitEvaluation(values: {
  evaluationId: string
  fields: readonly FormField[]
  values: RequestValues
}): Promise<EvaluationRow> {
  const response = await call(() =>
    browserClients.evaluations.submitEvaluation({
      evaluationId: values.evaluationId,
      values: valuesToProto(values.fields, values.values),
    }),
  )
  return required(response.evaluation)
}

export async function listEvaluations(query: EvaluationListQuery): Promise<EvaluationsPage> {
  const response = await call(() =>
    browserClients.evaluations.listEvaluations({
      status: statusFilterToProto(query.status),
      search: query.search,
      teamIds: [...query.teamIds],
      page: query.page,
      pageSize: 25,
    }),
  )

  const pageInfo = response.pageInfo
  if (!pageInfo) throw new Error('The server did not return page information.')

  return {
    rows: response.rows.map(evaluationFromProto),
    pageInfo: {
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
      total: pageInfo.total,
      pageCount: pageInfo.pageCount,
      hasPrevious: pageInfo.hasPrevious,
      hasNext: pageInfo.hasNext,
    },
  }
}

export async function assignEvaluations(values: AssignEvaluationsValues): Promise<EvaluationRow[]> {
  const response = await call(() =>
    browserClients.evaluations.assignEvaluations({
      formId: values.formId,
      evaluatorId: values.evaluatorId,
      employeeIds: values.employeeIds,
      dueAt: values.dueAt || undefined,
    }),
  )
  return response.rows.map(evaluationFromProto)
}

export async function cancelEvaluation(evaluationId: string): Promise<EvaluationRow> {
  const response = await call(() => browserClients.evaluations.cancelEvaluation({ evaluationId }))
  return required(response.evaluation)
}

export async function listCandidates(): Promise<EvaluationCandidate[]> {
  const response = await call(() => browserClients.evaluations.listCandidates({}))
  return response.people.map(candidateFromProto)
}
