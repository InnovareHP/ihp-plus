import { routes } from '@/lib/routes'
import type { SearchEntry, SearchTask } from '../schema'

export function taskEntries(tasks: readonly SearchTask[]): SearchEntry[] {
  return tasks.map((task) => ({
    id: `task:${task.taskId}`,
    kind: 'task',
    label: task.name,
    description: `#${task.taskNumber} · ${task.projectName}`,
    area: task.statusName || undefined,
    areaColor: task.statusColor || undefined,
    // Without ?project= the board behind the task shows whichever project was open last.
    href: `${routes.tasks}?${new URLSearchParams({ project: task.projectId, task: task.taskId })}`,
  }))
}
