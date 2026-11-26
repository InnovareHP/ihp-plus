'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { loadTakeaways, loadTakeawayStatus, saveTakeaways } from '../actions'
import type { DayRange } from '../days'
import { analyticsEvents } from '../events'
import { analyticsKeys } from '../query-keys'
import type { SavedTakeaways, TakeawaysValues } from '../schema'

const unwrap = <T>(result: { ok: true; data: T } | { ok: false; message: string }): T => {
  if (!result.ok) throw new Error(result.message)
  return result.data
}

export function useTakeaways(siteKey: string, range: DayRange) {
  return useQuery({
    queryKey: analyticsKeys.takeaways(siteKey, range.start, range.end),
    queryFn: async () => unwrap(await loadTakeaways(siteKey, range.start, range.end)),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useTakeawayStatus(range: DayRange) {
  return useQuery({
    queryKey: analyticsKeys.takeawayStatus(range.start, range.end),
    queryFn: async () => unwrap(await loadTakeawayStatus(range.start, range.end)),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useSaveTakeaways(siteKey: string, range: DayRange) {
  const queryClient = useQueryClient()
  const queryKey = analyticsKeys.takeaways(siteKey, range.start, range.end)
  const statusKey = analyticsKeys.takeawayStatus(range.start, range.end)

  return useMutation({
    mutationFn: async (values: TakeawaysValues) =>
      unwrap(await saveTakeaways(siteKey, range.start, range.end, values)),
    onMutate: async (values) => {
      // An in-flight refetch would land on top of the optimistic text.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<SavedTakeaways | null>(queryKey)
      const optimistic: SavedTakeaways = { ...values, updatedAt: new Date().toISOString() }
      queryClient.setQueryData(queryKey, optimistic)
      return { previous }
    },
    onError: (error: Error, _values, context) => {
      queryClient.setQueryData(queryKey, context?.previous ?? null)
      track(analyticsEvents.takeawaysSaveFailed, { siteKey })
      announceFailure(error.message)
    },
    onSuccess: () => track(analyticsEvents.takeawaysSaved, { siteKey }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: statusKey })
    },
  })
}
