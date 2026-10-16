import { normalize } from './rank'

/** "#12" and "12" both name task number 12; anything else is a search by name. */
export function taskNumberOf(query: string) {
  const match = /^#?(\d{1,9})$/.exec(query.trim())
  return match?.[1] ? Number(match[1]) : null
}

function scoreOf(task: { taskNumber: number; name: string }, query: string, number: number | null) {
  if (number !== null && task.taskNumber === number) return 0
  const name = normalize(task.name)
  if (name === query) return 1
  if (name.startsWith(query)) return 2
  if (name.split(/\s+/).some((word) => word.startsWith(query))) return 3
  return 4
}

/** Number first, then how early the name matches; ties keep the most recently updated first. */
export function rankTasks<T extends { taskNumber: number; name: string }>(
  tasks: readonly T[],
  query: string,
  limit: number,
): T[] {
  const normalized = normalize(query)
  const number = taskNumberOf(query)
  return tasks
    .map((task, index) => ({ task, index, score: scoreOf(task, normalized, number) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((hit) => hit.task)
}
