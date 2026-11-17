import type { DailyTaskKpiRow } from '../schema'

export interface KpiPerson {
  userId: string
  userName: string
  jobTitle: string | undefined
}

export interface KpiTask {
  /** YYYY-MM-DD */
  dueDate: string
  isDone: boolean
  /** Closed as dropped at clock-in: planned, never overdue. */
  isDropped: boolean
  rollovers: number
  assigneeIds: readonly string[]
}

/** One row per person on the roster, so someone who planned nothing still shows as a zero. */
export function dailyTaskKpis(
  people: readonly KpiPerson[],
  workedUserIds: readonly string[],
  tasks: readonly KpiTask[],
  today: string,
): DailyTaskKpiRow[] {
  const rows = new Map<string, DailyTaskKpiRow>(
    people.map((person) => [
      person.userId,
      { ...person, daysWorked: 0, planned: 0, completed: 0, overdue: 0, carriedOver: 0 },
    ]),
  )

  for (const userId of workedUserIds) {
    const row = rows.get(userId)
    if (row) row.daysWorked += 1
  }

  for (const task of tasks) {
    for (const userId of task.assigneeIds) {
      const row = rows.get(userId)
      if (!row) continue
      row.planned += 1
      row.carriedOver += task.rollovers
      if (task.isDone) row.completed += 1
      else if (!task.isDropped && task.dueDate < today) row.overdue += 1
    }
  }

  return [...rows.values()]
}

/** Whole percent, or undefined when nothing was planned — a 0% would read as a failure. */
export function completionRate(completed: number, planned: number): number | undefined {
  return planned > 0 ? Math.round((completed / planned) * 100) : undefined
}
