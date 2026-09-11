'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import {
  archiveClient,
  createClient,
  listClientFilterOptions,
  listClients,
  restoreClient,
  updateClient,
} from './actions'
import { clientEvents } from './events'
import { clientKeys } from './query-keys'
import type {
  ClientDraftValues,
  ClientQuery,
  ClientRow,
  ClientsPage,
  UpdateClientValues,
} from './schema'

export function useClients(query: ClientQuery) {
  return useQuery({
    queryKey: clientKeys.list(query),
    queryFn: async () => {
      const result = await listClients(query)
      if (!result.ok) throw new Error(result.message)
      return { rows: result.rows, pageInfo: result.pageInfo }
    },
    // Paging or refiltering keeps the previous page on screen instead of blanking the table.
    placeholderData: keepPreviousData,
  })
}

export function useClientFilterOptions() {
  return useQuery({
    queryKey: clientKeys.filterOptions(),
    queryFn: async () => {
      const result = await listClientFilterOptions()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

function optimisticRow(values: ClientDraftValues, ownerName: string): ClientRow {
  return {
    // Replaced by the server's id on settle; a list row is never keyed by its array index.
    id: crypto.randomUUID(),
    name: values.name.trim(),
    contactName: values.contactName,
    email: values.email,
    phone: values.phone,
    status: values.status,
    type: values.type,
    serviceLine: values.serviceLine,
    source: values.source,
    city: values.city,
    state: values.state,
    tags: values.tags,
    notes: values.notes,
    ownerId: values.ownerId,
    ownerName,
    lastContactAt: values.lastContactAt || undefined,
    createdAt: new Date().toISOString(),
    archivedAt: undefined,
  }
}

/** Every mutation writes into the page the user is looking at, then lets the server confirm. */
function usePageMutation<TVariables, TData>(
  query: ClientQuery,
  options: {
    mutationFn: (variables: TVariables) => Promise<TData>
    apply: (page: ClientsPage, variables: TVariables) => ClientsPage
    settle?: (page: ClientsPage, data: TData, variables: TVariables) => ClientsPage
    successEvent: (typeof clientEvents)[keyof typeof clientEvents]
    failureEvent: (typeof clientEvents)[keyof typeof clientEvents]
  },
) {
  const queryClient = useQueryClient()
  const key = clientKeys.list(query)

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (variables: TVariables) => {
      // An in-flight refetch would land on top of the optimistic page.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ClientsPage>(key)
      queryClient.setQueryData<ClientsPage>(key, (page) =>
        page ? options.apply(page, variables) : page,
      )
      return { previous }
    },
    onSuccess: (data, variables) => {
      if (options.settle) {
        queryClient.setQueryData<ClientsPage>(key, (page) =>
          page ? options.settle?.(page, data, variables) : page,
        )
      }
      track(options.successEvent)
    },
    onError: (error: Error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(options.failureEvent, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}

export function useCreateClient(query: ClientQuery, ownerNameOf: (ownerId: string) => string) {
  return usePageMutation<ClientDraftValues, ClientRow>(query, {
    mutationFn: async (values) => {
      const result = await createClient(values)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    // The new client goes to the top of the page in view; the refetch puts it where the sort wants it.
    apply: (page, values) => ({
      rows: [optimisticRow(values, ownerNameOf(values.ownerId)), ...page.rows],
      pageInfo: { ...page.pageInfo, total: page.pageInfo.total + 1 },
    }),
    settle: (page, saved) => ({
      ...page,
      rows: page.rows.map((row, index) => (index === 0 ? saved : row)),
    }),
    successEvent: clientEvents.created,
    failureEvent: clientEvents.createFailed,
  })
}

export function useUpdateClient(query: ClientQuery, ownerNameOf: (ownerId: string) => string) {
  return usePageMutation<UpdateClientValues, ClientRow>(query, {
    mutationFn: async (values) => {
      const result = await updateClient(values)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    apply: (page, values) => ({
      ...page,
      rows: page.rows.map((row) =>
        row.id === values.id
          ? {
              ...row,
              ...values,
              ownerName: ownerNameOf(values.ownerId),
              lastContactAt: values.lastContactAt || undefined,
            }
          : row,
      ),
    }),
    settle: (page, saved) => ({
      ...page,
      rows: page.rows.map((row) => (row.id === saved.id ? saved : row)),
    }),
    successEvent: clientEvents.updated,
    failureEvent: clientEvents.updateFailed,
  })
}

export function useArchiveClient(query: ClientQuery) {
  return usePageMutation<{ id: string; name: string }, null>(query, {
    mutationFn: async ({ id }) => {
      const result = await archiveClient({ id })
      if (!result.ok) throw new Error(result.message)
      return null
    },
    // The row leaves immediately; the undo toast is what makes that safe.
    apply: (page, { id }) => ({
      rows: page.rows.filter((row) => row.id !== id),
      pageInfo: { ...page.pageInfo, total: Math.max(0, page.pageInfo.total - 1) },
    }),
    successEvent: clientEvents.archived,
    failureEvent: clientEvents.archiveFailed,
  })
}

export function useRestoreClient(query: ClientQuery) {
  return usePageMutation<{ id: string }, null>(query, {
    mutationFn: async ({ id }) => {
      const result = await restoreClient({ id })
      if (!result.ok) throw new Error(result.message)
      return null
    },
    // Restoring from the archived view removes the row from it; the live list refetches either way.
    apply: (page, { id }) => ({
      rows: page.rows.filter((row) => row.id !== id),
      pageInfo: { ...page.pageInfo, total: Math.max(0, page.pageInfo.total - 1) },
    }),
    successEvent: clientEvents.restored,
    failureEvent: clientEvents.restoreFailed,
  })
}
