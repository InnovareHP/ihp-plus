'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { offerUndo } from '@/lib/undo'
import { hiringEvents } from '../events'
import { hiringKeys } from '../query-keys'
import {
  addNote,
  deleteNote,
  getApplication,
  hireApplication,
  listApplications,
  listPipeline,
  moveApplication,
  rejectApplication,
  reopenApplication,
} from '../rpc'
import type {
  ApplicationDetail,
  ApplicationNote,
  ApplicationQuery,
  ApplicationsPage,
  ApplicationSummary,
  MoveValues,
  NoteValues,
  RejectValues,
  Stage,
} from '../schema'

export function useApplications(query: ApplicationQuery) {
  return useQuery({
    queryKey: hiringKeys.applications(query),
    queryFn: () => listApplications(query),
    // A filtered list must not blank out between pages.
    placeholderData: (previous) => previous,
  })
}

export function usePipeline(postingId: string) {
  return useQuery({
    queryKey: hiringKeys.pipeline(postingId),
    queryFn: () => listPipeline(postingId),
    // HR works a board for a while; refetching on every focus would only reshuffle it.
    staleTime: 60 * 1000,
  })
}

export function useApplication(applicationId: string, initialData?: ApplicationDetail) {
  return useQuery({
    queryKey: hiringKeys.application(applicationId),
    queryFn: () => getApplication(applicationId),
    initialData,
  })
}

type Snapshot = [QueryKey, unknown][]

function matchesQuery(row: ApplicationSummary, query: ApplicationQuery | undefined) {
  if (!query) return true
  if (query.status !== 'all' && row.status !== query.status) return false
  if (query.stageId && row.stageId !== query.stageId) return false
  return true
}

/**
 * Repaints one applicant in every cached list page, board and detail view, returning what they
 * held before so a failure or an undo puts back exactly that.
 */
async function applyEverywhere(
  queryClient: QueryClient,
  applicationId: string,
  patch: (row: ApplicationSummary) => ApplicationSummary,
): Promise<Snapshot> {
  // In-flight refetches would land on top of the optimistic value.
  await queryClient.cancelQueries({ queryKey: hiringKeys.all })
  const snapshot: Snapshot = [
    ...queryClient.getQueriesData({ queryKey: hiringKeys.applicationLists() }),
    ...queryClient.getQueriesData({ queryKey: hiringKeys.pipelines() }),
    ...queryClient.getQueriesData({ queryKey: hiringKeys.application(applicationId) }),
  ]

  for (const [key, page] of queryClient.getQueriesData<ApplicationsPage>({
    queryKey: hiringKeys.applicationLists(),
  })) {
    if (!page) continue
    const query = key[2] as ApplicationQuery | undefined
    const rows = page.rows.flatMap((row) => {
      if (row.id !== applicationId) return [row]
      const next = patch(row)
      // A row that no longer matches the view's filter leaves it, the way a refetch would.
      return matchesQuery(next, query) ? [next] : []
    })
    queryClient.setQueryData<ApplicationsPage>(key, { ...page, rows })
  }

  queryClient.setQueriesData<ApplicationSummary[]>({ queryKey: hiringKeys.pipelines() }, (rows) =>
    rows?.flatMap((row) => {
      if (row.id !== applicationId) return [row]
      const next = patch(row)
      return next.status === 'active' ? [next] : []
    }),
  )

  queryClient.setQueryData<ApplicationDetail>(hiringKeys.application(applicationId), (detail) =>
    detail ? { ...detail, summary: patch(detail.summary) } : detail,
  )

  return snapshot
}

function restore(queryClient: QueryClient, snapshot: Snapshot) {
  for (const [key, data] of snapshot) queryClient.setQueryData(key, data)
}

function settle(queryClient: QueryClient, applicationId: string) {
  queryClient.invalidateQueries({ queryKey: hiringKeys.applicationLists() })
  queryClient.invalidateQueries({ queryKey: hiringKeys.pipelines() })
  queryClient.invalidateQueries({ queryKey: hiringKeys.application(applicationId) })
  // Stage counts on the posting move with the applicant.
  queryClient.invalidateQueries({ queryKey: hiringKeys.postingLists() })
}

// Optimistic: the card lands in its new column the moment HR picks the stage.
export function useMoveApplication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: MoveValues & { stage: Stage }) =>
      moveApplication({
        applicationId: values.applicationId,
        stageId: values.stageId,
        sendEmail: values.sendEmail,
        message: values.message,
      }),
    onMutate: async (values) => {
      const now = new Date().toISOString()
      const snapshot = await applyEverywhere(queryClient, values.applicationId, (row) => ({
        ...row,
        stageId: values.stage.id,
        stageName: values.stage.name,
        stageChangedAt: now,
      }))
      return { snapshot }
    },
    onError: (error: Error, _values, context) => {
      if (context) restore(queryClient, context.snapshot)
      track(hiringEvents.moveFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSuccess: (_row, values) => {
      track(hiringEvents.moved, { stageId: values.stageId, emailed: values.sendEmail })
    },
    onSettled: (_data, _error, values) => settle(queryClient, values.applicationId),
  })
}

// Undo over confirm: the applicant leaves the pipeline at once, and the decision (and its email)
// only reaches the server when the toast closes, so both an undo and a refusal restore one snapshot.
export function useRejectWithUndo() {
  const queryClient = useQueryClient()
  const reject = useMutation({
    mutationFn: (values: RejectValues) => rejectApplication(values),
    onSettled: (_data, _error, values) => settle(queryClient, values.applicationId),
  })

  return async (values: RejectValues, name: string) => {
    const snapshot = await applyEverywhere(queryClient, values.applicationId, (row) => ({
      ...row,
      status: 'rejected',
    }))

    offerUndo({
      message: `Not moving forward with ${name}`,
      undoLabel: 'Undo',
      onUndo: () => restore(queryClient, snapshot),
      onCommit: () =>
        reject.mutate(values, {
          onSuccess: () => track(hiringEvents.rejected, { emailed: values.sendEmail }),
          onError: (error: Error) => {
            restore(queryClient, snapshot)
            track(hiringEvents.rejectFailed, { reason: error.message })
            announceFailure(error.message)
          },
        }),
    })
  }
}

export function useReopenApplication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (applicationId: string) => reopenApplication(applicationId),
    onMutate: async (applicationId) => {
      const snapshot = await applyEverywhere(queryClient, applicationId, (row) => ({
        ...row,
        status: 'active',
      }))
      return { snapshot }
    },
    onError: (error: Error, _applicationId, context) => {
      if (context) restore(queryClient, context.snapshot)
      track(hiringEvents.reopenFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSuccess: () => track(hiringEvents.reopened),
    onSettled: (_data, _error, applicationId) => settle(queryClient, applicationId),
  })
}

// Optimistic with a temporary id, swapped for the server's on settle.
export function useAddNote(authorName: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: NoteValues) => addNote(values),
    onMutate: async (values) => {
      const key = hiringKeys.application(values.applicationId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ApplicationDetail>(key)
      const pending: ApplicationNote = {
        id: `pending-${crypto.randomUUID()}`,
        authorId: '',
        authorName,
        body: values.body,
        createdAt: new Date().toISOString(),
        isMine: true,
      }
      if (previous) {
        queryClient.setQueryData<ApplicationDetail>(key, {
          ...previous,
          notes: [...previous.notes, pending],
        })
      }
      return { previous }
    },
    onError: (error: Error, values, context) => {
      queryClient.setQueryData(hiringKeys.application(values.applicationId), context?.previous)
      track(hiringEvents.noteAddFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSuccess: () => track(hiringEvents.noteAdded),
    onSettled: (_data, _error, values) =>
      queryClient.invalidateQueries({ queryKey: hiringKeys.application(values.applicationId) }),
  })
}

// Undo over confirm: the note goes at once and is only deleted when the toast closes.
export function useDeleteNoteWithUndo(applicationId: string) {
  const queryClient = useQueryClient()
  const key = hiringKeys.application(applicationId)
  const remove = useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  return async (note: ApplicationNote) => {
    await queryClient.cancelQueries({ queryKey: key })
    const previous = queryClient.getQueryData<ApplicationDetail>(key)
    if (previous) {
      queryClient.setQueryData<ApplicationDetail>(key, {
        ...previous,
        notes: previous.notes.filter((one) => one.id !== note.id),
      })
    }

    offerUndo({
      message: 'Deleted your note',
      undoLabel: 'Undo',
      onUndo: () => queryClient.setQueryData(key, previous),
      onCommit: () =>
        remove.mutate(note.id, {
          onSuccess: () => track(hiringEvents.noteDeleted),
          onError: (error: Error) => {
            queryClient.setQueryData(key, previous)
            track(hiringEvents.noteDeleteFailed, { reason: error.message })
            announceFailure(error.message)
          },
        }),
    })
  }
}

// Not optimistic: hiring sends an invitation email, so the page waits for the server to say it went.
export function useHireApplication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: { applicationId: string; teamId: string }) => hireApplication(values),
    onMutate: () => track(hiringEvents.hireStarted),
    onSuccess: (detail) => {
      track(hiringEvents.hired, { existingMember: detail.joined })
      queryClient.setQueryData(hiringKeys.application(detail.summary.id), detail)
    },
    onError: (error: Error) => track(hiringEvents.hireFailed, { reason: error.message }),
    onSettled: (_data, _error, values) => settle(queryClient, values.applicationId),
  })
}
