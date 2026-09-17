import type { TaskRow, TaskStatusRow } from '../schema'

export interface TaskStatusGroupData {
  status: TaskStatusRow
  items: { task: TaskRow; canMoveUp: boolean; canMoveDown: boolean }[]
}

/** Groups a list's tasks by their status, keeping the arrows pointed at the list's own order. */
export function groupTasksByStatus(tasks: readonly TaskRow[]): TaskStatusGroupData[] {
  const groups = new Map<string, TaskStatusGroupData>()

  tasks.forEach((task, index) => {
    const group = groups.get(task.statusId) ?? { status: task.status, items: [] }
    group.items.push({
      task,
      canMoveUp: index > 0,
      canMoveDown: index < tasks.length - 1,
    })
    groups.set(task.statusId, group)
  })

  return [...groups.values()].sort((a, b) => a.status.sortOrder - b.status.sortOrder)
}
