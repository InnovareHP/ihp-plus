'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { loadNetlifyReport } from '../actions'
import type { DayRange } from '../days'
import { analyticsEvents } from '../events'
import { analyticsKeys } from '../query-keys'

export function useNetlifyReport(siteKey: string, range: DayRange, enabled: boolean) {
  return useQuery({
    queryKey: analyticsKeys.netlify(siteKey, range.start, range.end),
    queryFn: async () => {
      const result = await loadNetlifyReport(siteKey, range.start, range.end)
      if (!result.ok) {
        track(analyticsEvents.reportFailed, { siteKey, source: 'netlify' })
        throw new Error(result.message)
      }
      track(analyticsEvents.reportLoaded, { siteKey, source: 'netlify' })
      return result.data
    },
    enabled,
    // Saved days change once a night, so ten minutes is fresh enough.
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Keeps the last report on screen while the next site or range loads.
    placeholderData: keepPreviousData,
  })
}
