'use client'

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { track, type EventName } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { offerUndo } from '@/lib/undo'

export interface UndoableDeleteOptions<TData> {
  /** Prefix key: every cached entry under it loses the row. */
  queryKey: QueryKey
  mutationFn: (id: string) => Promise<void>
  remove: (data: TData, id: string) => TData
  message: string
  successEvent: EventName
  failureEvent: EventName
  alsoInvalidate?: readonly QueryKey[]
}

type Snapshot<TData> = [QueryKey, TData | undefined][]

// The row goes at once and the server hears about it only when the undo window closes, so undo
// is a cancelled call rather than a second one.
export function useUndoableDelete<TData>(options: UndoableDeleteOptions<TData>) {
  const queryClient = useQueryClient()

  function restore(previous: Snapshot<TData>) {
    for (const [key, data] of previous) queryClient.setQueryData(key, data)
  }

  const commit = useMutation({
    mutationFn: (variables: { id: string; previous: Snapshot<TData> }) =>
      options.mutationFn(variables.id),
    onError: (error: Error, variables) => {
      restore(variables.previous)
      // The row coming back explains nothing on its own.
      announceFailure(error.message)
      track(options.failureEvent, { reason: error.message })
    },
    onSuccess: () => track(options.successEvent),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: options.queryKey })
      for (const key of options.alsoInvalidate ?? []) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })

  async function remove(id: string) {
    // An in-flight refetch would put the row straight back.
    await queryClient.cancelQueries({ queryKey: options.queryKey })
    const previous = queryClient.getQueriesData<TData>({ queryKey: options.queryKey })
    queryClient.setQueriesData<TData>({ queryKey: options.queryKey }, (data) =>
      data ? options.remove(data, id) : data,
    )

    offerUndo({
      message: options.message,
      undoLabel: 'Undo',
      onUndo: () => restore(previous),
      onCommit: () => commit.mutate({ id, previous }),
    })
  }

  return { remove, isPending: commit.isPending }
}
