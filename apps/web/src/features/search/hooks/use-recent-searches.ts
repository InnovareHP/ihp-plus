'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { SearchEntry } from '../schema'
import { NO_RECENT, readRecent, rememberRecent, subscribeRecent } from '../utils/recent-searches'

export function useRecentSearches(storageKey: string) {
  const entries = useSyncExternalStore(
    subscribeRecent,
    () => readRecent(storageKey),
    () => NO_RECENT,
  )
  const remember = useCallback(
    (entry: SearchEntry) => rememberRecent(storageKey, entry),
    [storageKey],
  )
  return { entries, remember }
}
