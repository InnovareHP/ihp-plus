'use client'

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { track, type EventName } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'

export interface OptimisticListMutationOptions<TRow, TVariables> {
  queryKey: QueryKey
  mutationFn: (variables: TVariables) => Promise<void>
  /** Returns the list as it should read the instant the user clicks. */
  apply: (rows: readonly TRow[], variables: TVariables) => TRow[]
  successEvent: EventName
  failureEvent: EventName
  /** Keys the same change also touches — a count on another screen, say. */
  alsoInvalidate?: readonly QueryKey[]
}

// Every list CRUD in this app applies to the cache first and restores the snapshot on failure,
// so the four callbacks live here once instead of in each feature hook.
export function useOptimisticListMutation<TRow, TVariables>(
  options: OptimisticListMutationOptions<TRow, TVariables>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (variables: TVariables) => {
      // An in-flight refetch would land on top of the optimistic list.
      await queryClient.cancelQueries({ queryKey: options.queryKey })
      const previous = queryClient.getQueryData<TRow[]>(options.queryKey)
      if (previous) {
        queryClient.setQueryData<TRow[]>(options.queryKey, options.apply(previous, variables))
      }
      return { previous }
    },
    onError: (error: Error, _variables, context) => {
      queryClient.setQueryData(options.queryKey, context?.previous)
      track(options.failureEvent, { reason: error.message })
      announceFailure(error.message)
    },
    onSuccess: () => {
      track(options.successEvent)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: options.queryKey })
      for (const key of options.alsoInvalidate ?? []) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}

export interface OptimisticPagesMutationOptions<TPage, TVariables> {
  /** Prefix key: every cached page and filter combination under it is patched. */
  queryKey: QueryKey
  mutationFn: (variables: TVariables) => Promise<void>
  apply: (page: TPage, variables: TVariables) => TPage
  successEvent: EventName
  failureEvent: EventName
  alsoInvalidate?: readonly QueryKey[]
}

// A server-paged list caches one entry per page and filter set, so the optimistic row has to be
// written into all of them — the row the user clicked may sit in more than one cached page.
export function useOptimisticPagesMutation<TPage, TVariables>(
  options: OptimisticPagesMutationOptions<TPage, TVariables>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (variables: TVariables) => {
      // An in-flight refetch would land on top of the optimistic page.
      await queryClient.cancelQueries({ queryKey: options.queryKey })
      const previous = queryClient.getQueriesData<TPage>({ queryKey: options.queryKey })

      queryClient.setQueriesData<TPage>({ queryKey: options.queryKey }, (page) =>
        page ? options.apply(page, variables) : page,
      )

      return { previous }
    },
    onError: (error: Error, _variables, context) => {
      for (const [key, page] of context?.previous ?? []) {
        queryClient.setQueryData(key, page)
      }
      track(options.failureEvent, { reason: error.message })
      announceFailure(error.message)
    },
    onSuccess: () => {
      track(options.successEvent)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: options.queryKey })
      for (const key of options.alsoInvalidate ?? []) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}
