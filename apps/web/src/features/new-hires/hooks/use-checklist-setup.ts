'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import {
  createChecklistTask,
  getChecklistSetup,
  removeChecklistTask,
  requireDocument,
  unrequireDocument,
} from '../actions'
import { newHireEvents } from '../events'
import { newHireKeys } from '../query-keys'
import type { ChecklistSetup, NewTaskValues } from '../schema'

export function useChecklistSetup() {
  return useQuery({
    queryKey: newHireKeys.setup(),
    queryFn: async () => {
      const result = await getChecklistSetup()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
  })
}

type Change = (setup: ChecklistSetup) => ChecklistSetup

/** Every setup change follows one shape: write the cache, roll back on failure, then refetch. */
function useSetupMutation<TVariables>(options: {
  mutationFn: (variables: TVariables) => Promise<unknown>
  apply: (variables: TVariables) => Change
  successEvent: (typeof newHireEvents)[keyof typeof newHireEvents]
  failureEvent: (typeof newHireEvents)[keyof typeof newHireEvents]
  failure: string
}) {
  const queryClient = useQueryClient()
  const key = newHireKeys.setup()

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ChecklistSetup>(key)
      queryClient.setQueryData<ChecklistSetup>(key, (setup) =>
        setup ? options.apply(variables)(setup) : setup,
      )
      return { previous }
    },
    onSuccess: () => track(options.successEvent),
    onError: (error: Error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(options.failureEvent, { reason: error.message })
      announceFailure(`${options.failure} — ${error.message}`)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      // A hire's progress depends on this list, so the new-hire table is stale too.
      void queryClient.invalidateQueries({ queryKey: newHireKeys.list() })
    },
  })
}

async function unwrap(result: Promise<{ ok: true } | { ok: false; message: string }>) {
  const settled = await result
  if (!settled.ok) throw new Error(settled.message)
}

export function useRequireDocument() {
  return useSetupMutation({
    mutationFn: ({ documentId }: { documentId: string }) => unwrap(requireDocument({ documentId })),
    apply:
      ({ documentId }) =>
      (setup) => {
        const document = setup.availableDocuments.find((one) => one.id === documentId)
        if (!document) return setup
        return {
          ...setup,
          // The audience is the server's to work out; the refetch fills it in.
          requiredDocuments: [
            ...setup.requiredDocuments,
            { documentId, title: document.title, audience: '…' },
          ],
          availableDocuments: setup.availableDocuments.filter((one) => one.id !== documentId),
        }
      },
    successEvent: newHireEvents.documentRequired,
    failureEvent: newHireEvents.documentRequireFailed,
    failure: 'Could not add that document',
  })
}

export function useAddChecklistTask() {
  return useSetupMutation({
    mutationFn: (values: NewTaskValues & { tempId: string }) =>
      unwrap(createChecklistTask({ title: values.title, description: values.description })),
    apply: (values) => (setup) => ({
      ...setup,
      tasks: [
        ...setup.tasks,
        // A temporary id until the refetch brings the server's.
        { id: values.tempId, title: values.title, description: values.description || undefined },
      ],
    }),
    successEvent: newHireEvents.setupTaskAdded,
    failureEvent: newHireEvents.setupTaskAddFailed,
    failure: 'Could not add that task',
  })
}

/**
 * A removal leaves the cache when the undo is offered and reaches the server only when the
 * toast closes, so undo is a cancelled call rather than a second one.
 */
function useDeferredRemoval<TVariables>(options: {
  mutationFn: (variables: TVariables) => Promise<unknown>
  remove: (variables: TVariables) => Change
  successEvent: (typeof newHireEvents)[keyof typeof newHireEvents]
  failureEvent: (typeof newHireEvents)[keyof typeof newHireEvents]
  failure: string
}) {
  const queryClient = useQueryClient()
  const key = newHireKeys.setup()

  const commit = useMutation({
    mutationFn: (variables: TVariables & { previous: ChecklistSetup | undefined }) =>
      options.mutationFn(variables),
    onSuccess: () => track(options.successEvent),
    onError: (error: Error, variables) => {
      queryClient.setQueryData(key, variables.previous)
      track(options.failureEvent, { reason: error.message })
      announceFailure(`${options.failure} — ${error.message}`)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: newHireKeys.list() })
    },
  })

  return {
    apply: (variables: TVariables) => {
      void queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ChecklistSetup>(key)
      queryClient.setQueryData<ChecklistSetup>(key, (setup) =>
        setup ? options.remove(variables)(setup) : setup,
      )
      return previous
    },
    restore: (previous: ChecklistSetup | undefined) => queryClient.setQueryData(key, previous),
    commit,
  }
}

export function useUnrequireDocument() {
  return useDeferredRemoval({
    mutationFn: ({ documentId }: { documentId: string }) =>
      unwrap(unrequireDocument({ documentId })),
    remove:
      ({ documentId }) =>
      (setup) => {
        const removed = setup.requiredDocuments.find((one) => one.documentId === documentId)
        return {
          ...setup,
          requiredDocuments: setup.requiredDocuments.filter((one) => one.documentId !== documentId),
          availableDocuments: removed
            ? [...setup.availableDocuments, { id: documentId, title: removed.title }].sort((a, b) =>
                a.title.localeCompare(b.title),
              )
            : setup.availableDocuments,
        }
      },
    successEvent: newHireEvents.documentUnrequired,
    failureEvent: newHireEvents.documentUnrequireFailed,
    failure: 'Could not take that document off the list',
  })
}

export function useRemoveChecklistTask() {
  return useDeferredRemoval({
    mutationFn: ({ taskId }: { taskId: string }) => unwrap(removeChecklistTask({ taskId })),
    remove:
      ({ taskId }) =>
      (setup) => ({ ...setup, tasks: setup.tasks.filter((task) => task.id !== taskId) }),
    successEvent: newHireEvents.setupTaskRemoved,
    failureEvent: newHireEvents.setupTaskRemoveFailed,
    failure: 'Could not remove that task',
  })
}
