'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import {} from '@/features/teams/actions'
import {
  acknowledgeDocument,
  archiveDocument,
  documentLink,
  listBluebookOptions,
  listDocuments,
  purgeDocument,
  restoreDocument,
  updateDocument,
  uploadDocument,
} from '../actions'
import { bluebookEvents } from '../events'
import { bluebookKeys } from '../query-keys'
import type { BluebookQuery, DocumentRow, DocumentsPage, UpdateDocumentValues } from '../schema'

export function useDocuments(query: BluebookQuery) {
  return useQuery({
    queryKey: bluebookKeys.list(query),
    queryFn: async () => {
      const result = await listDocuments(query)
      if (!result.ok) throw new Error(result.message)
      return { rows: result.rows, pageInfo: result.pageInfo }
    },
    // Paging or refiltering keeps the previous page on screen instead of blanking the shelf.
    placeholderData: keepPreviousData,
  })
}

export function useBluebookOptions() {
  return useQuery({
    queryKey: bluebookKeys.options(),
    queryFn: async () => {
      const result = await listBluebookOptions()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
  })
}

function useDocumentMutation<TVariables, TData>(
  query: BluebookQuery,
  options: {
    mutationFn: (variables: TVariables) => Promise<TData>
    apply?: (page: DocumentsPage, variables: TVariables) => DocumentsPage
    successEvent: (typeof bluebookEvents)[keyof typeof bluebookEvents]
    failureEvent: (typeof bluebookEvents)[keyof typeof bluebookEvents]
  },
) {
  const queryClient = useQueryClient()
  const key = bluebookKeys.list(query)

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (variables: TVariables) => {
      if (!options.apply) return { previous: undefined }
      // An in-flight refetch would land on top of the optimistic page.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<DocumentsPage>(key)
      queryClient.setQueryData<DocumentsPage>(key, (page) =>
        page ? options.apply?.(page, variables) : page,
      )
      return { previous }
    },
    onSuccess: () => track(options.successEvent),
    onError: (error: Error, _variables, context) => {
      if (options.apply) queryClient.setQueryData(key, context?.previous)
      track(options.failureEvent, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bluebookKeys.lists() })
      // The shelf counts on the sidebar move with any filing change.
      queryClient.invalidateQueries({ queryKey: bluebookKeys.options() })
    },
  })
}

/**
 * No optimistic row for an upload: the bytes have to reach storage first, and a row that
 * appeared before the file existed would offer a download that 404s.
 */
export function useUploadDocument(query: BluebookQuery) {
  return useDocumentMutation<FormData, DocumentRow>(query, {
    mutationFn: async (formData) => {
      const result = await uploadDocument(formData)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    successEvent: bluebookEvents.uploaded,
    failureEvent: bluebookEvents.uploadFailed,
  })
}

export function useUpdateDocument(query: BluebookQuery) {
  return useDocumentMutation<UpdateDocumentValues, DocumentRow>(query, {
    mutationFn: async (values) => {
      const result = await updateDocument(values)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    apply: (page, values) => ({
      ...page,
      rows: page.rows.map((row) =>
        row.id === values.id
          ? {
              ...row,
              title: values.title,
              description: values.description,
              category: values.category,
            }
          : row,
      ),
    }),
    successEvent: bluebookEvents.updated,
    failureEvent: bluebookEvents.updateFailed,
  })
}

export function useArchiveDocument(query: BluebookQuery) {
  return useDocumentMutation<{ id: string; title: string }, null>(query, {
    mutationFn: async ({ id }) => {
      const result = await archiveDocument({ id })
      if (!result.ok) throw new Error(result.message)
      return null
    },
    // The row leaves immediately; the undo toast is what makes that safe.
    apply: (page, { id }) => ({
      rows: page.rows.filter((row) => row.id !== id),
      pageInfo: { ...page.pageInfo, total: Math.max(0, page.pageInfo.total - 1) },
    }),
    successEvent: bluebookEvents.archived,
    failureEvent: bluebookEvents.archiveFailed,
  })
}

export function useRestoreDocument(query: BluebookQuery) {
  return useDocumentMutation<{ id: string }, null>(query, {
    mutationFn: async ({ id }) => {
      const result = await restoreDocument({ id })
      if (!result.ok) throw new Error(result.message)
      return null
    },
    apply: (page, { id }) => ({
      rows: page.rows.filter((row) => row.id !== id),
      pageInfo: { ...page.pageInfo, total: Math.max(0, page.pageInfo.total - 1) },
    }),
    successEvent: bluebookEvents.restored,
    failureEvent: bluebookEvents.restoreFailed,
  })
}

export function usePurgeDocument(query: BluebookQuery) {
  return useDocumentMutation<{ id: string }, null>(query, {
    mutationFn: async ({ id }) => {
      const result = await purgeDocument({ id })
      if (!result.ok) throw new Error(result.message)
      return null
    },
    apply: (page, { id }) => ({
      rows: page.rows.filter((row) => row.id !== id),
      pageInfo: { ...page.pageInfo, total: Math.max(0, page.pageInfo.total - 1) },
    }),
    successEvent: bluebookEvents.purged,
    failureEvent: bluebookEvents.purgeFailed,
  })
}

export function useAcknowledgeDocument(query: BluebookQuery) {
  return useDocumentMutation<{ id: string }, { acknowledgedAt: string }>(query, {
    mutationFn: async ({ id }) => {
      const result = await acknowledgeDocument({ id })
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    // Marked read at once; the server's own timestamp replaces this one when the list refetches.
    apply: (page, { id }) => ({
      ...page,
      rows: page.rows.map((row) =>
        row.id === id
          ? {
              ...row,
              acknowledgedAt: new Date().toISOString(),
              readCount: row.readCount === undefined ? undefined : row.readCount + 1,
            }
          : row,
      ),
    }),
    successEvent: bluebookEvents.acknowledged,
    failureEvent: bluebookEvents.acknowledgeFailed,
  })
}

/** Minted per click and opened straight away, so the link never sits in the page's HTML. */
export function useOpenDocument() {
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await documentLink({ id })
      if (!result.ok) throw new Error(result.message)
      return result.data.url
    },
    onSuccess: (url) => {
      track(bluebookEvents.opened)
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    onError: (error: Error) => {
      track(bluebookEvents.openFailed, { reason: error.message })
      announceFailure(error.message)
    },
  })
}
