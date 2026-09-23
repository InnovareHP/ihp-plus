'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { getMyChecklist, markTaskDone } from '../actions'
import { newHireEvents } from '../events'
import { newHireKeys } from '../query-keys'
import type { NewHireChecklistView } from '../schema'

/** Seeded from the server render, so the dashboard paints the checklist with no loading flash. */
export function useMyChecklist(initial: NewHireChecklistView | null) {
  return useQuery({
    queryKey: newHireKeys.mine(),
    queryFn: async () => {
      const result = await getMyChecklist()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    initialData: initial,
    // Reading and a shift happen on other screens, so a minute-old view is fresh enough here.
    staleTime: 60 * 1000,
  })
}

function withTask(view: NewHireChecklistView, taskId: string, done: boolean) {
  const items = view.tasks.items.map((item) => (item.id === taskId ? { ...item, done } : item))
  return { ...view, tasks: { done: items.every((item) => item.done), items } }
}

export function useMarkTaskDone() {
  const queryClient = useQueryClient()
  const key = newHireKeys.mine()

  return useMutation({
    mutationFn: async (variables: { taskId: string; done: boolean }) => {
      const result = await markTaskDone(variables)
      if (!result.ok) throw new Error(result.message)
    },
    onMutate: async ({ taskId, done }) => {
      // An in-flight refetch would land on top of the tick and undo it on screen.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<NewHireChecklistView | null>(key)
      queryClient.setQueryData<NewHireChecklistView | null>(key, (view) =>
        view ? withTask(view, taskId, done) : view,
      )
      return { previous }
    },
    onSuccess: (_data, { done }) =>
      track(done ? newHireEvents.taskCompleted : newHireEvents.taskReopened),
    onError: (error: Error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(newHireEvents.taskToggleFailed, { reason: error.message })
      announceFailure(`Could not update that task — ${error.message}`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
