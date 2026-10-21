import type { SearchTask } from '../schema'
import { rankTasks, taskNumberOf } from './rank-tasks'

export interface CachedTaskSearch {
  query: string
  tasks: readonly SearchTask[] | undefined
  /** Past the freshness window, an earlier answer may miss a task renamed since. */
  fresh: boolean
}

/**
 * Answers a longer query from a shorter one already in the cache, when that earlier answer was
 * complete (fewer rows than the limit): every name containing "renew" also contains "ren".
 */
export function narrowFromCache(
  cached: readonly CachedTaskSearch[],
  query: string,
  limit: number,
): SearchTask[] | null {
  const wanted = query.toLowerCase()
  // A number search also matches task numbers, which a name-only earlier answer cannot cover.
  if (taskNumberOf(wanted) !== null) return null

  let best: CachedTaskSearch | null = null
  for (const entry of cached) {
    if (!entry.tasks || entry.tasks.length >= limit || !entry.fresh) continue
    if (entry.query === wanted || !wanted.startsWith(entry.query)) continue
    if (taskNumberOf(entry.query) !== null) continue
    if (!best || entry.query.length > best.query.length) best = entry
  }
  if (!best?.tasks) return null

  const matches = best.tasks.filter((task) => task.name.toLowerCase().includes(wanted))
  return rankTasks(matches, query, limit)
}
