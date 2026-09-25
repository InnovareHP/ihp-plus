'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { bulletinKeys } from '../query-keys'
import { getUnreadCount, markSeen } from '../rpc'

// Other people post while the viewer is elsewhere in the app, so the badge polls, gently.
const UNREAD_POLL = 60 * 1000

export function useBulletinUnread() {
  return useQuery({
    queryKey: bulletinKeys.unread(),
    queryFn: getUnreadCount,
    staleTime: 30 * 1000,
    refetchInterval: UNREAD_POLL,
  })
}

/**
 * Opening the board is the visit: this records it once per mount and returns the visit before,
 * which is where the feed draws its "new since" line. A query rather than an effect, so it runs
 * with the page and not after it; gcTime 0 makes the next mount a new visit.
 */
export function useBoardVisit() {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: bulletinKeys.visit(),
    queryFn: async () => {
      const previous = await markSeen()
      queryClient.setQueryData(bulletinKeys.unread(), 0)
      // A query cannot resolve to undefined, so a first visit is an empty string.
      return previous ?? ''
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
