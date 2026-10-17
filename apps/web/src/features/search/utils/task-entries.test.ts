import { describe, expect, it } from 'vitest'
import { routes } from '@/lib/routes'
import { taskEntries } from './task-entries'

describe('taskEntries', () => {
  it('turns a task into a result that opens it on its own project’s board', () => {
    const [entry] = taskEntries([
      {
        taskId: 'task-1',
        taskNumber: 12,
        name: 'Renewal pack',
        projectId: 'project-1',
        projectName: 'Renewals',
        statusName: 'In review',
        statusColor: '#1346C5',
      },
    ])

    expect(entry).toEqual({
      id: 'task:task-1',
      kind: 'task',
      label: 'Renewal pack',
      description: '#12 · Renewals',
      area: 'In review',
      areaColor: '#1346C5',
      href: `${routes.tasks}?project=project-1&task=task-1`,
    })
  })
})
