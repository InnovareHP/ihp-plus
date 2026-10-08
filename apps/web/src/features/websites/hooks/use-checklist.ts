'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { loadChecklist, recordCheck, runRound } from '../actions'
import { websiteEvents } from '../events'
import { websiteKeys } from '../query-keys'
import type { CheckRound, Checklist, RecordCheckValues } from '../schema'

export function useChecklist(date: string) {
  return useQuery({
    queryKey: websiteKeys.checklist(date),
    queryFn: async () => {
      const result = await loadChecklist(date || undefined)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    // Stepping through days keeps the last one on screen instead of blanking the list.
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })
}

// Not optimistic: the verdict for each site is whatever the probe reads, which the client cannot know.
export function useRunRound(date: string) {
  const queryClient = useQueryClient()
  const key = websiteKeys.checklist(date)

  return useMutation({
    mutationFn: async (input: { round: CheckRound; websiteId?: string }) => {
      track(websiteEvents.roundStarted, { round: input.round, single: Boolean(input.websiteId) })
      const result = await runRound(input)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: (checklist, input) => {
      queryClient.setQueryData<Checklist>(key, checklist)
      track(websiteEvents.roundCompleted, {
        round: input.round,
        down: checklist.websites.filter((site) => site.checks[input.round]?.status === 'down')
          .length,
      })
    },
    onError: (error: Error, input) => {
      track(websiteEvents.roundFailed, { round: input.round, reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: websiteKeys.checklists() })
    },
  })
}

export function useRecordCheck(date: string, checkedByName: string) {
  const queryClient = useQueryClient()
  const key = websiteKeys.checklist(date)

  return useMutation({
    mutationFn: async (values: RecordCheckValues) => {
      const result = await recordCheck(values)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onMutate: async (values) => {
      // An in-flight refetch would land on top of the optimistic verdict.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Checklist>(key)
      queryClient.setQueryData<Checklist>(key, (list) =>
        list
          ? {
              ...list,
              websites: list.websites.map((site) => {
                if (site.id !== values.websiteId) return site
                const before = site.checks[values.round]
                return {
                  ...site,
                  checks: {
                    ...site.checks,
                    [values.round]: {
                      httpStatus: before?.httpStatus,
                      responseMs: before?.responseMs,
                      error: before?.error ?? '',
                      status: values.status,
                      note: values.note,
                      checkedByName,
                      checkedAt: new Date().toISOString(),
                    },
                  },
                }
              }),
            }
          : list,
      )
      return { previous }
    },
    onSuccess: (_row, values) => {
      track(websiteEvents.checkRecorded, { round: values.round, status: values.status })
    },
    onError: (error: Error, values, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(websiteEvents.checkRecordFailed, { round: values.round, reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: websiteKeys.checklists() })
    },
  })
}
