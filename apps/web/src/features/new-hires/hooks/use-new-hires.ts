'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { closeNewHireChecklist, getNewHires } from '../actions'
import { newHireEvents } from '../events'
import { newHireKeys } from '../query-keys'
import type { NewHireRow } from '../schema'

export function useNewHires() {
  return useQuery({
    queryKey: newHireKeys.list(),
    queryFn: async () => {
      const result = await getNewHires()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    // Hires move through steps on other screens; half a minute keeps a tab switch honest.
    staleTime: 30 * 1000,
  })
}

/** The row is closed in the cache when the undo is offered; this commits it once the toast goes. */
export function useCloseChecklist() {
  const queryClient = useQueryClient()
  const key = newHireKeys.list()

  return {
    /** Applied at once, and returned so an undo restores exactly what was there. */
    applyClose: (userId: string) => {
      void queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<NewHireRow[]>(key)
      queryClient.setQueryData<NewHireRow[]>(key, (rows) =>
        rows?.map((row) =>
          row.userId === userId
            ? { ...row, completedAt: new Date().toISOString(), closedByAdmin: true }
            : row,
        ),
      )
      return previous
    },
    restore: (previous: NewHireRow[] | undefined) => queryClient.setQueryData(key, previous),
    commit: useMutation({
      mutationFn: async (variables: { userId: string; previous: NewHireRow[] | undefined }) => {
        const result = await closeNewHireChecklist({ userId: variables.userId })
        if (!result.ok) throw new Error(result.message)
      },
      onSuccess: () => track(newHireEvents.checklistClosed),
      onError: (error: Error, variables) => {
        queryClient.setQueryData(key, variables.previous)
        track(newHireEvents.checklistCloseFailed, { reason: error.message })
        announceFailure(`Could not close that checklist — ${error.message}`)
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    }),
  }
}
