import type { ServiceImpl } from '@ihp/rpc'
import { EvaluationsService } from '@ihp/rpc/evaluations'
import {
  assignEvaluations,
  cancelEvaluation,
  loadCandidates,
  loadEvaluation,
  loadEvaluationsPage,
  loadMyEvaluations,
  submitEvaluation,
} from '@/features/evaluations/service'
import { candidateToProto, evaluationToProto, statusFilterFromProto } from './evaluations-codec'
import { valuesFromProto } from './requests-codec'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const evaluations: ServiceImpl<typeof EvaluationsService> = {
  listMyEvaluations: async (request) => ({
    rows: (await loadMyEvaluations(statusFilterFromProto(request.status))).map(evaluationToProto),
  }),

  getEvaluation: async (request) => ({
    evaluation: evaluationToProto(await loadEvaluation(request.evaluationId)),
  }),

  submitEvaluation: async (request) => ({
    evaluation: evaluationToProto(
      await submitEvaluation({
        evaluationId: request.evaluationId,
        values: valuesFromProto(request.values),
      }),
    ),
  }),

  listEvaluations: async (request) => {
    const page = await loadEvaluationsPage({
      status: statusFilterFromProto(request.status),
      search: request.search,
      teamIds: request.teamIds,
      page: request.page || 1,
      pageSize: request.pageSize || 25,
    })

    return {
      rows: page.rows.map(evaluationToProto),
      pageInfo: { $typeName: 'ihp.requests.v1.PageInfo', ...page.pageInfo },
    }
  },

  assignEvaluations: async (request) => {
    const rows = await assignEvaluations({
      formId: request.formId,
      evaluatorId: request.evaluatorId,
      employeeIds: request.employeeIds,
      dueAt: request.dueAt ?? '',
    })
    return { rows: rows.map(evaluationToProto) }
  },

  cancelEvaluation: async (request) => ({
    evaluation: evaluationToProto(await cancelEvaluation(request.evaluationId)),
  }),

  listCandidates: async () => ({ people: (await loadCandidates()).map(candidateToProto) }),
}
