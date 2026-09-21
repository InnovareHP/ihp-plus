import type { EvaluationListQuery, MyEvaluationQuery } from './schema'

export const evaluationKeys = {
  all: ['evaluations'] as const,
  /** Prefix over every cached page, so an optimistic row reaches all of them. */
  mines: () => [...evaluationKeys.all, 'mine'] as const,
  mine: (query: MyEvaluationQuery) => [...evaluationKeys.mines(), query] as const,
  tracker: (query: EvaluationListQuery) => [...evaluationKeys.all, 'tracker', query] as const,
  trackers: () => [...evaluationKeys.all, 'tracker'] as const,
  detail: (evaluationId: string) => [...evaluationKeys.all, 'detail', evaluationId] as const,
  candidates: () => [...evaluationKeys.all, 'candidates'] as const,
}
