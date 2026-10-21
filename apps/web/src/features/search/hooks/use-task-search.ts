'use client'

import { useDebouncedValue } from '@mantine/hooks'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { searchEvents } from '../events'
import { searchKeys } from '../query-keys'
import { searchTasks } from '../rpc'
import { TASK_RESULT_LIMIT, type SearchTask } from '../schema'
import { narrowFromCache, type CachedTaskSearch } from '../utils/narrow-tasks'

export const TASK_SEARCH_DELAY = 300
const MIN_LENGTH = 2
const MAX_LENGTH = 100
const STALE_TIME = 60 * 1000
const NONE: SearchTask[] = []

/**
 * Tasks are too many to load whole, so they are asked for by query: only after a pause in
 * typing, cancelled when a newer query replaces them, and answered from the cache when an
 * earlier, shorter query already holds every match.
 */
export function useTaskSearch(query: string) {
  const queryClient = useQueryClient()
  const trimmed = query.trim()
  const [settled] = useDebouncedValue(trimmed, TASK_SEARCH_DELAY)
  // The server matches case-insensitively, so "Renew" and "renew" share one cache entry.
  const key = settled.toLowerCase()
  const ready = key.length >= MIN_LENGTH && key.length <= MAX_LENGTH

  const cached: CachedTaskSearch[] = queryClient
    .getQueryCache()
    .findAll({ queryKey: searchKeys.taskQueries() })
    .map((entry) => ({
      query: String(entry.queryKey[2] ?? ''),
      tasks: entry.state.data as SearchTask[] | undefined,
      fresh: !entry.isStaleByTime(STALE_TIME),
    }))
  const narrowed = ready ? narrowFromCache(cached, key, TASK_RESULT_LIMIT) : null

  const search = useQuery({
    queryKey: searchKeys.tasks(key),
    queryFn: async ({ signal }) => {
      try {
        return await searchTasks(key, signal)
      } catch (error) {
        // A cancelled request is a newer query taking over, not a failure worth reporting.
        if (!signal.aborted) track(searchEvents.tasksFailed)
        throw error
      }
    },
    enabled: ready && !narrowed,
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  })

  const asking = ready && !narrowed
  return {
    tasks: !ready ? NONE : (narrowed ?? search.data ?? NONE),
    /** Still typing: the pause has not passed yet, so no answer is due. */
    isWaiting: trimmed.length >= MIN_LENGTH && trimmed !== settled,
    isLoading: asking && search.isPending,
    isError: asking && search.isError,
    retry: () => void search.refetch(),
  }
}
