'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { useOptimisticPagesMutation } from '@/lib/optimistic'
import { requestEvents } from '../events'
import { requestKeys } from '../query-keys'
import {
  decideRequest,
  getRequest,
  listAvailableForms,
  listMyRequests,
  listRequests,
  submitRequest,
  withdrawRequest,
} from '../rpc'
import type {
  DecisionValues,
  FormField,
  MyRequestQuery,
  RequestQuery,
  RequestRow,
  RequestValues,
  RequestsPage,
} from '../schema'

export function useAvailableForms() {
  return useQuery({
    queryKey: requestKeys.available(),
    queryFn: listAvailableForms,
  })
}

export function useMyRequests(query: MyRequestQuery) {
  return useQuery({
    queryKey: requestKeys.mine(query),
    queryFn: () => listMyRequests(query),
    // A filtered list must not blank out between pages.
    placeholderData: (previous) => previous,
  })
}

export function useRequestQueue(query: RequestQuery, enabled = true) {
  return useQuery({
    queryKey: requestKeys.queue(query),
    enabled,
    queryFn: () => listRequests(query),
    // A filtered list must not blank out between pages.
    placeholderData: (previous) => previous,
  })
}

export function useRequest(submissionId: string) {
  return useQuery({
    queryKey: requestKeys.detail(submissionId),
    queryFn: () => getRequest(submissionId),
  })
}

// Not optimistic: the submission's id, timestamps and queue placement are all the server's,
// and the user is sent to the request it created rather than back to a list.
export function useSubmitRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: { formId: string; fields: readonly FormField[]; values: RequestValues }) =>
      submitRequest(values),
    onSuccess: (row) => {
      track(requestEvents.requestSubmitted)
      queryClient.setQueryData(requestKeys.detail(row.id), row)
      queryClient.invalidateQueries({ queryKey: requestKeys.all })
    },
    onError: (error: Error) => {
      track(requestEvents.requestSubmitFailed, { reason: error.message })
    },
  })
}

export function useWithdrawRequest() {
  return useOptimisticPagesMutation<RequestsPage, { submissionId: string }>({
    queryKey: requestKeys.mines(),
    mutationFn: async (values) => {
      await withdrawRequest(values.submissionId)
    },
    apply: (page, values) => ({
      ...page,
      rows: page.rows.map((row: RequestRow) =>
        row.id === values.submissionId
          ? { ...row, status: 'withdrawn' as const, canDecide: false }
          : row,
      ),
    }),
    successEvent: requestEvents.requestWithdrawn,
    failureEvent: requestEvents.requestWithdrawFailed,
    alsoInvalidate: [requestKeys.queues()],
  })
}

// Optimistic: approving or rejecting is a predictable state change on a row already on screen.
export function useDecideRequest(query: RequestQuery) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: DecisionValues) => decideRequest(values),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: requestKeys.queue(query) })
      const previous = queryClient.getQueryData<{ rows: RequestRow[] }>(requestKeys.queue(query))

      queryClient.setQueryData<{ rows: RequestRow[] }>(requestKeys.queue(query), (page) =>
        page
          ? {
              ...page,
              rows: page.rows.map((row) =>
                row.id === values.submissionId
                  ? {
                      ...row,
                      status: values.decision,
                      decisionNote: values.note || undefined,
                      canDecide: false,
                    }
                  : row,
              ),
            }
          : page,
      )

      return { previous }
    },
    onError: (error: Error, _values, context) => {
      queryClient.setQueryData(requestKeys.queue(query), context?.previous)
      track(requestEvents.requestDecideFailed, { reason: error.message })
      // The row snapping back needs a reason, or the click reads as never having landed.
      announceFailure(error.message)
    },
    onSuccess: (row) => {
      track(requestEvents.requestDecided, { decision: row.status })
      queryClient.setQueryData(requestKeys.detail(row.id), row)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: requestKeys.queues() })
    },
  })
}

// The detail page decides one request rather than a row in a filtered queue, so it invalidates
// instead of patching a page that may not be cached.
export function useDecideOne() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: DecisionValues) => decideRequest(values),
    onSuccess: (row) => {
      track(requestEvents.requestDecided, { decision: row.status })
      queryClient.setQueryData(requestKeys.detail(row.id), row)
      queryClient.invalidateQueries({ queryKey: requestKeys.queues() })
    },
    onError: (error: Error) => {
      track(requestEvents.requestDecideFailed, { reason: error.message })
      announceFailure(error.message)
    },
  })
}
