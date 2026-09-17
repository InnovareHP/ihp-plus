import { describe, expect, it } from 'vitest'
import { boardQuerySchema, isTaskDone, isTaskOverdue, taskFormSchema, type TaskRow } from './schema'

const TASK: TaskRow = {
  id: 'task-1',
  taskNumber: 1,
  name: 'Send the renewal pack',
  description: '',
  priority: 'normal',
  projectId: 'project-1',
  listId: 'list-1',
  statusId: 'status-1',
  status: { id: 'status-1', name: 'To do', color: '#95E5DC', category: 'active', sortOrder: 2 },
  assignees: [],
  startDate: undefined,
  dueDate: '2026-09-10T00:00:00.000Z',
  completedAt: undefined,
  isArchived: false,
  position: 1024,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

const NOW = new Date('2026-09-17T00:00:00.000Z')

describe('taskFormSchema', () => {
  it('accepts a minimal task and fills its defaults', () => {
    const parsed = taskFormSchema.parse({
      projectId: 'project-1',
      listId: 'list-1',
      name: '  Call the facility  ',
    })

    expect(parsed).toMatchObject({
      name: 'Call the facility',
      description: '',
      priority: 'normal',
      dueDate: '',
      assigneeIds: [],
    })
  })

  it('refuses a task with no title', () => {
    const result = taskFormSchema.safeParse({
      projectId: 'project-1',
      listId: 'list-1',
      name: '   ',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Say what has to be done.')
  })

  it('refuses a task with no list', () => {
    const result = taskFormSchema.safeParse({ projectId: 'project-1', listId: '', name: 'Call' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Pick a list.')
  })
})

describe('boardQuerySchema', () => {
  it('reads the board state out of the URL', () => {
    expect(
      boardQuerySchema.parse({
        project: 'project-1',
        assignee: 'mine',
        search: 'renewal',
        archived: 'true',
      }),
    ).toEqual({
      project: 'project-1',
      list: '',
      assignee: 'mine',
      search: 'renewal',
      archived: true,
    })
  })

  it('falls back rather than throwing on a hand-edited filter', () => {
    expect(boardQuerySchema.parse({ assignee: 'nobody' }).assignee).toBe('all')
  })
})

describe('task state helpers', () => {
  it('treats a task in a done column as done', () => {
    expect(isTaskDone(TASK)).toBe(false)
    expect(isTaskDone({ ...TASK, status: { ...TASK.status, category: 'done' } })).toBe(true)
  })

  it('counts a past due date as overdue only while the task is open', () => {
    expect(isTaskOverdue(TASK, NOW)).toBe(true)
    expect(isTaskOverdue({ ...TASK, status: { ...TASK.status, category: 'done' } }, NOW)).toBe(
      false,
    )
    expect(isTaskOverdue({ ...TASK, dueDate: undefined }, NOW)).toBe(false)
  })
})
