import { routes } from '@/lib/routes'
import type { SearchEntry, SearchTask } from '../schema'

// Rows saved before status colours were validated on update may hold anything.
const HEX = /^#[0-9a-f]{6}$/i

export function taskEntries(tasks: readonly SearchTask[]): SearchEntry[] {
  return tasks.map((task) => ({
    id: `task:${task.taskId}`,
    kind: 'task',
    label: task.name,
    description: `#${task.taskNumber} · ${task.projectName}`,
    area: task.statusName || undefined,
    areaColor: HEX.test(task.statusColor) ? task.statusColor : undefined,
    // Without ?project= the board behind the task shows whichever project was open last.
    href: `${routes.tasks}?${new URLSearchParams({ project: task.projectId, task: task.taskId })}`,
  }))
}
