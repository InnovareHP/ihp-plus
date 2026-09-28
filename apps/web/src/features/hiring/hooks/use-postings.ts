'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { offerUndo } from '@/lib/undo'
import { hiringEvents } from '../events'
import { hiringKeys } from '../query-keys'
import { deletePosting, getPosting, listPostings, savePosting, setPostingStatus } from '../rpc'
import type {
  PostingDraftValues,
  PostingQuery,
  PostingRow,
  PostingsPage,
  PostingStatus,
} from '../schema'

export function usePostings(query: PostingQuery) {
  return useQuery({
    queryKey: hiringKeys.postings(query),
    queryFn: () => listPostings(query),
    // A filtered list must not blank out between pages.
    placeholderData: (previous) => previous,
  })
}

export function usePosting(postingId: string, initialData?: PostingRow) {
  return useQuery({
    queryKey: hiringKeys.posting(postingId),
    queryFn: () => getPosting(postingId),
    initialData,
  })
}

// Not optimistic: the server mints the slug and id of a new posting, and the editor lands on it.
export function useSavePosting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: PostingDraftValues) => savePosting(draft),
    onSuccess: (posting, draft) => {
      track(draft.postingId ? hiringEvents.postingSaved : hiringEvents.postingCreated, {
        postingId: posting.id,
      })
      queryClient.setQueryData(hiringKeys.posting(posting.id), posting)
      queryClient.invalidateQueries({ queryKey: hiringKeys.postingLists() })
    },
    onError: (error: Error) => {
      track(hiringEvents.postingSaveFailed, { reason: error.message })
    },
  })
}

const STATUS_EVENTS = {
  open: hiringEvents.postingOpened,
  closed: hiringEvents.postingClosed,
  archived: hiringEvents.postingArchived,
  draft: hiringEvents.postingSaved,
} as const

// Optimistic: a status is a predictable change to a row already on screen.
export function useSetPostingStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: { postingId: string; status: PostingStatus }) => setPostingStatus(values),
    onMutate: async (values) => {
      // An in-flight refetch would land on top of the optimistic status.
      await queryClient.cancelQueries({ queryKey: hiringKeys.all })
      const pages = queryClient.getQueriesData<PostingsPage>({
        queryKey: hiringKeys.postingLists(),
      })
      const detail = queryClient.getQueryData<PostingRow>(hiringKeys.posting(values.postingId))

      queryClient.setQueriesData<PostingsPage>({ queryKey: hiringKeys.postingLists() }, (page) =>
        page
          ? {
              ...page,
              rows: page.rows.map((row) =>
                row.id === values.postingId ? { ...row, status: values.status } : row,
              ),
            }
          : page,
      )
      if (detail) {
        queryClient.setQueryData(hiringKeys.posting(values.postingId), {
          ...detail,
          status: values.status,
        })
      }
      return { pages, detail }
    },
    onError: (error: Error, values, context) => {
      for (const [key, page] of context?.pages ?? []) queryClient.setQueryData(key, page)
      if (context?.detail)
        queryClient.setQueryData(hiringKeys.posting(values.postingId), context.detail)
      track(hiringEvents.postingStatusFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSuccess: (posting) => {
      track(STATUS_EVENTS[posting.status], { postingId: posting.id })
    },
    onSettled: (_data, _error, values) => {
      queryClient.invalidateQueries({ queryKey: hiringKeys.postingLists() })
      queryClient.invalidateQueries({ queryKey: hiringKeys.posting(values.postingId) })
    },
  })
}

// Undo over confirm: the draft leaves the list at once and the server is only told when the
// toast closes, so both an undo and a refusal restore the same snapshot.
export function useDeleteDraftWithUndo() {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: (postingId: string) => deletePosting(postingId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: hiringKeys.postingLists() }),
  })

  return (row: PostingRow) => {
    const snapshot = queryClient.getQueriesData<PostingsPage>({
      queryKey: hiringKeys.postingLists(),
    })
    const restore = () => {
      for (const [key, page] of snapshot) queryClient.setQueryData(key, page)
    }

    queryClient.setQueriesData<PostingsPage>({ queryKey: hiringKeys.postingLists() }, (page) =>
      page
        ? {
            ...page,
            rows: page.rows.filter((one) => one.id !== row.id),
            pageInfo: { ...page.pageInfo, total: Math.max(0, page.pageInfo.total - 1) },
          }
        : page,
    )

    offerUndo({
      message: `Deleted the draft ${row.title}`,
      undoLabel: 'Undo',
      onUndo: restore,
      onCommit: () =>
        remove.mutate(row.id, {
          onSuccess: () => track(hiringEvents.postingDeleted, { postingId: row.id }),
          onError: (error: Error) => {
            restore()
            track(hiringEvents.postingDeleteFailed, { reason: error.message })
            announceFailure(error.message)
          },
        }),
    })
  }
}
