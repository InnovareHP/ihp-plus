import type { EvaluationListQuery, EvaluationStatusFilter } from './schema'

export const evaluationKeys = {
  all: ['evaluations'] as const,
  mine: (status: EvaluationStatusFilter) => [...evaluationKeys.all, 'mine', status] as const,
  tracker: (query: EvaluationListQuery) => [...evaluationKeys.all, 'tracker', query] as const,
  trackers: () => [...evaluationKeys.all, 'tracker'] as const,
  detail: (evaluationId: string) => [...evaluationKeys.all, 'detail', evaluationId] as const,
  candidates: () => [...evaluationKeys.all, 'candidates'] as const,
}
