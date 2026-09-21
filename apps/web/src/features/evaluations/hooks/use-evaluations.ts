'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { useOptimisticPagesMutation } from '@/lib/optimistic'
import type { FormField, RequestValues } from '@/features/requests/schema'
import { evaluationEvents } from '../events'
import { evaluationKeys } from '../query-keys'
import {
  assignEvaluations,
  cancelEvaluation,
  getEvaluation,
  listCandidates,
  listEvaluations,
  listMyEvaluations,
  submitEvaluation,
} from '../rpc'
import type {
  AssignEvaluationsValues,
  EvaluationListQuery,
  EvaluationRow,
  EvaluationsPage,
  MyEvaluationQuery,
} from '../schema'

export function useMyEvaluations(query: MyEvaluationQuery) {
  return useQuery({
    queryKey: evaluationKeys.mine(query),
    queryFn: () => listMyEvaluations(query),
    // A filtered list must not blank out between pages.
    placeholderData: (previous) => previous,
  })
}

export function useEvaluationTracker(query: EvaluationListQuery) {
  return useQuery({
    queryKey: evaluationKeys.tracker(query),
    queryFn: () => listEvaluations(query),
    // A filtered list must not blank out between pages.
    placeholderData: (previous) => previous,
  })
}

export function useEvaluation(evaluationId: string) {
  return useQuery({
    queryKey: evaluationKeys.detail(evaluationId),
    queryFn: () => getEvaluation(evaluationId),
  })
}

export function useEvaluationCandidates() {
  return useQuery({
    queryKey: evaluationKeys.candidates(),
    queryFn: listCandidates,
    // Who works here changes far less often than the evaluations assigned to them.
    staleTime: 5 * 60 * 1000,
  })
}

// Not optimistic: the server assigns the ids and skips anyone who already has one waiting, so
// there is nothing dependable to paint before it answers.
export function useAssignEvaluations() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: AssignEvaluationsValues) => assignEvaluations(values),
    onSuccess: (rows) => {
      track(evaluationEvents.assigned, { count: rows.length })
      queryClient.invalidateQueries({ queryKey: evaluationKeys.all })
    },
    onError: (error: Error) => {
      track(evaluationEvents.assignFailed, { reason: error.message })
    },
  })
}

// Not optimistic: the submission lands the evaluator on what they filled in, and the server
// stamps when it happened.
export function useSubmitEvaluation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: {
      evaluationId: string
      fields: readonly FormField[]
      values: RequestValues
    }) => submitEvaluation(values),
    onSuccess: (row) => {
      track(evaluationEvents.submitted)
      queryClient.setQueryData(evaluationKeys.detail(row.id), row)
      queryClient.invalidateQueries({ queryKey: evaluationKeys.all })
    },
    onError: (error: Error) => {
      track(evaluationEvents.submitFailed, { reason: error.message })
      announceFailure(error.message)
    },
  })
}

// Optimistic: cancelling is a predictable state change on a row already on screen.
export function useCancelEvaluation() {
  return useOptimisticPagesMutation<EvaluationsPage, { evaluationId: string }>({
    queryKey: evaluationKeys.trackers(),
    mutationFn: async (values) => {
      await cancelEvaluation(values.evaluationId)
    },
    apply: (page, values) => ({
      ...page,
      rows: page.rows.map((row) =>
        row.id === values.evaluationId
          ? ({ ...row, status: 'cancelled', canFill: false } satisfies EvaluationRow)
          : row,
      ),
    }),
    successEvent: evaluationEvents.cancelled,
    failureEvent: evaluationEvents.cancelFailed,
  })
}
