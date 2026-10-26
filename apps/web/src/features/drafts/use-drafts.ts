'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { draftRoute } from '@/lib/routes'
import { createDraft, getDraft, listDrafts, sendDraftMessage, undoDraftChange } from './actions'
import { draftEvents } from './events'
import { draftKeys } from './query-keys'
import type { DraftDetail, NewContractValues } from './schema'

async function unwrap<T>(result: Promise<{ ok: true; data: T } | { ok: false; message: string }>) {
  const settled = await result
  if (!settled.ok) throw new Error(settled.message)
  return settled.data
}

export function useDrafts() {
  return useQuery({
    queryKey: draftKeys.list(),
    queryFn: () => unwrap(listDrafts()),
    staleTime: 30 * 1000,
  })
}

export function useDraft(draftId: string, initialData: DraftDetail) {
  return useQuery({
    queryKey: draftKeys.detail(draftId),
    queryFn: () => unwrap(getDraft(draftId)),
    initialData,
    staleTime: 60 * 1000,
  })
}

// Not optimistic: the new draft's page needs the id only the server hands out.
export function useCreateDraft() {
  const router = useRouter()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ proposal }: NewContractValues) => {
      const formData = new FormData()
      if (proposal) formData.set('proposal', proposal)
      return unwrap(createDraft(formData))
    },
    onSuccess: (draft, { proposal }) => {
      track(draftEvents.created, { fromProposal: Boolean(proposal) })
      router.push(draftRoute(draft.id))
    },
    // The dialog shows the reason beside the file, so there is no toast here.
    onError: (error: Error, { proposal }) =>
      track(draftEvents.createFailed, { fromProposal: Boolean(proposal), reason: error.message }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: draftKeys.list() }),
  })
}

/** The admin's message shows at once; the AI's reply and the new document land together. */
export function useSendDraftMessage(draftId: string) {
  const queryClient = useQueryClient()
  const key = draftKeys.detail(draftId)

  return useMutation({
    mutationFn: (text: string) => unwrap(sendDraftMessage(draftId, text)),
    onMutate: async (text) => {
      // An in-flight refetch would land on top of the optimistic message.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<DraftDetail>(key)
      queryClient.setQueryData<DraftDetail>(key, (draft) =>
        draft
          ? { ...draft, messages: [...draft.messages, { role: 'user', content: text }] }
          : draft,
      )
      return { previous }
    },
    onSuccess: (draft) => {
      queryClient.setQueryData(key, draft)
      track(draftEvents.messageSent, { kind: draft.kind })
    },
    onError: (error: Error, _text, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(draftEvents.messageFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: draftKeys.list() })
    },
  })
}

// Not optimistic: the earlier document lives only on the server.
export function useUndoDraftChange(draftId: string) {
  const queryClient = useQueryClient()
  const key = draftKeys.detail(draftId)

  return useMutation({
    mutationFn: () => unwrap(undoDraftChange(draftId)),
    onSuccess: (draft) => {
      queryClient.setQueryData(key, draft)
      track(draftEvents.undone)
    },
    onError: (error: Error) => {
      track(draftEvents.undoFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
