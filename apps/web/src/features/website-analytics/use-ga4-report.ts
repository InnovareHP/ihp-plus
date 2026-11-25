'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { loadGa4Report } from './actions'
import type { DayRange } from './days'
import { analyticsEvents } from './events'
import { analyticsKeys } from './query-keys'

export function useGa4Report(siteKey: string, range: DayRange, enabled: boolean) {
  return useQuery({
    queryKey: analyticsKeys.ga4(siteKey, range.start, range.end),
    queryFn: async () => {
      const result = await loadGa4Report(siteKey, range.start, range.end)
      if (!result.ok) {
        track(analyticsEvents.reportFailed, { siteKey, source: 'ga4' })
        throw new Error(result.message)
      }
      track(analyticsEvents.reportLoaded, { siteKey, source: 'ga4' })
      return result.data
    },
    enabled,
    // Finished days do not change, and GA4 bills every request against a daily quota.
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Keeps the last report on screen while the next site or range loads.
    placeholderData: keepPreviousData,
  })
}
