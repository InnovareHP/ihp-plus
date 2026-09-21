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
  commentCount: 0,
  attachmentCount: 0,
  trackedSeconds: 0,
  parentId: undefined,
  subtasks: [],
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

describe('taskFormSchema', () => {
  const base = {
    projectId: 'project-1',
    listId: 'list-1',
    name: 'Send the renewal pack',
  }

  it('refuses a due date before the start', () => {
    const result = taskFormSchema.safeParse({
      ...base,
      startDate: '2026-10-02',
      dueDate: '2026-10-01',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      path: ['dueDate'],
      message: 'The due date cannot be before the start.',
    })
  })

  it('takes a range, and either end on its own', () => {
    expect(
      taskFormSchema.safeParse({ ...base, startDate: '2026-10-01', dueDate: '2026-10-02' }).success,
    ).toBe(true)
    expect(taskFormSchema.safeParse({ ...base, startDate: '2026-10-01' }).success).toBe(true)
    expect(taskFormSchema.safeParse({ ...base, dueDate: '2026-10-02' }).success).toBe(true)
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
      view: 'board',
      person: '',
      status: '',
      priority: [],
      due: 'any',
      task: '',
      tab: 'task',
      list: '',
      assignee: 'mine',
      search: 'renewal',
      archived: true,
    })
  })

  it('falls back to the first panel when the tab in the URL is not one of them', () => {
    expect(boardQuerySchema.parse({ task: 'task-1', tab: 'files' }).tab).toBe('task')
    expect(boardQuerySchema.parse({ task: 'task-1', tab: 'history' }).tab).toBe('history')
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
