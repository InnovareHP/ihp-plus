'use client'

import { useQuery } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { searchEvents } from '../events'
import { searchKeys } from '../query-keys'
import { getSearchDirectory } from '../rpc'

/**
 * Fetched once when the palette opens, then filtered in the browser on every keystroke;
 * five minutes is fresh enough for a name or a client added since.
 */
export function useSearchDirectory() {
  return useQuery({
    queryKey: searchKeys.directory(),
    queryFn: async () => {
      try {
        return await getSearchDirectory()
      } catch (error) {
        track(searchEvents.directoryFailed)
        throw error
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
