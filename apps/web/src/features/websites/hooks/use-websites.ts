'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import {
  archiveWebsite,
  createWebsite,
  exportMonth,
  listClientOptions,
  restoreWebsite,
  saveItTeam,
  updateWebsite,
} from '../actions'
import { downloadFile } from '@/lib/download'
import { websiteEvents } from '../events'
import { websiteKeys } from '../query-keys'
import type {
  Checklist,
  ItTeamValues,
  UpdateWebsiteValues,
  WebsiteDraftValues,
  WebsiteRow,
} from '../schema'
import { monthCsv, monthCsvName } from '../utils/csv'

export function useClientOptions() {
  return useQuery({
    queryKey: websiteKeys.clientOptions(),
    queryFn: async () => {
      const result = await listClientOptions()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

type Event = (typeof websiteEvents)[keyof typeof websiteEvents]

/** Every list edit lands on today's checklist first, then the server confirms it. */
function useListMutation<TVariables, TData>(options: {
  mutationFn: (variables: TVariables) => Promise<TData>
  apply: (rows: WebsiteRow[], variables: TVariables) => WebsiteRow[]
  settle?: (rows: WebsiteRow[], data: TData, variables: TVariables) => WebsiteRow[]
  successEvent: Event
  failureEvent: Event
}) {
  const queryClient = useQueryClient()
  // Edits only ever happen on today's list, which is the empty-date key.
  const key = websiteKeys.checklist('')

  function write(update: (rows: WebsiteRow[]) => WebsiteRow[]) {
    queryClient.setQueryData<Checklist>(key, (list) =>
      list ? { ...list, websites: update(list.websites) } : list,
    )
  }

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (variables: TVariables) => {
      // An in-flight refetch would land on top of the optimistic list.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Checklist>(key)
      write((rows) => options.apply(rows, variables))
      return { previous }
    },
    onSuccess: (data, variables) => {
      if (options.settle) write((rows) => options.settle?.(rows, data, variables) ?? rows)
      track(options.successEvent)
    },
    onError: (error: Error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(options.failureEvent, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: websiteKeys.checklists() })
    },
  })
}

function byName(rows: WebsiteRow[]) {
  return [...rows].sort((left, right) => left.name.localeCompare(right.name))
}

export function useCreateWebsite(clientNameOf: (clientId: string) => string) {
  return useListMutation<WebsiteDraftValues & { tempId: string }, WebsiteRow>({
    mutationFn: async ({ name, url, clientId, notes }) => {
      const result = await createWebsite({ name, url, clientId, notes })
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    apply: (rows, values) =>
      byName([
        ...rows,
        {
          // Replaced by the server's id on settle; a row is never keyed by its index.
          id: values.tempId,
          name: values.name,
          url: values.url,
          clientId: values.clientId,
          clientName: clientNameOf(values.clientId),
          notes: values.notes,
          checks: {},
        },
      ]),
    settle: (rows, saved, values) => rows.map((row) => (row.id === values.tempId ? saved : row)),
    successEvent: websiteEvents.created,
    failureEvent: websiteEvents.createFailed,
  })
}

export function useUpdateWebsite(clientNameOf: (clientId: string) => string) {
  return useListMutation<UpdateWebsiteValues, WebsiteRow>({
    mutationFn: async (values) => {
      const result = await updateWebsite(values)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    apply: (rows, values) =>
      byName(
        rows.map((row) =>
          row.id === values.id
            ? { ...row, ...values, clientName: clientNameOf(values.clientId) }
            : row,
        ),
      ),
    settle: (rows, saved) => rows.map((row) => (row.id === saved.id ? saved : row)),
    successEvent: websiteEvents.updated,
    failureEvent: websiteEvents.updateFailed,
  })
}

export function useArchiveWebsite() {
  return useListMutation<{ id: string }, null>({
    mutationFn: async ({ id }) => {
      const result = await archiveWebsite({ id })
      if (!result.ok) throw new Error(result.message)
      return null
    },
    // The row leaves immediately; the undo toast is what makes that safe.
    apply: (rows, { id }) => rows.filter((row) => row.id !== id),
    successEvent: websiteEvents.archived,
    failureEvent: websiteEvents.archiveFailed,
  })
}

export function useRestoreWebsite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const result = await restoreWebsite({ id })
      if (!result.ok) throw new Error(result.message)
    },
    onError: (error: Error) => announceFailure(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: websiteKeys.checklists() }),
  })
}

export function useExportMonth() {
  return useMutation({
    mutationFn: async (month: string) => {
      const result = await exportMonth(month)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: (file) => {
      downloadFile({
        fileName: monthCsvName(file.month),
        contentType: 'text/csv;charset=utf-8',
        bytes: new TextEncoder().encode(monthCsv(file)),
      })
      track(websiteEvents.exported, { rows: file.rows.length })
    },
    onError: (error: Error) => {
      track(websiteEvents.exportFailed, { reason: error.message })
    },
  })
}

export function useSaveItTeam() {
  return useMutation({
    mutationFn: async (values: ItTeamValues) => {
      const result = await saveItTeam(values)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: () => track(websiteEvents.itTeamSaved),
    onError: (error: Error) => track(websiteEvents.itTeamSaveFailed, { reason: error.message }),
  })
}
