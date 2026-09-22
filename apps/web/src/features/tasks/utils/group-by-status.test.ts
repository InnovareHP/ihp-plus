import { describe, expect, it } from 'vitest'
import type { TaskRow, TaskStatusRow } from '../schema'
import { groupTasksByStatus } from './group-by-status'

const TODO: TaskStatusRow = {
  id: 'status-todo',
  name: 'To do',
  color: '#95E5DC',
  category: 'active',
  sortOrder: 2,
}
const BACKLOG: TaskStatusRow = {
  id: 'status-backlog',
  name: 'Backlog',
  color: '#64748b',
  category: 'active',
  sortOrder: 1,
}

function task(id: string, status: TaskStatusRow): TaskRow {
  return {
    id,
    taskNumber: 1,
    name: id,
    description: '',
    priority: 'normal',
    projectId: 'project-1',
    listId: 'list-1',
    statusId: status.id,
    status,
    assignees: [],
    startDate: undefined,
    dueDate: undefined,
    completedAt: undefined,
    isArchived: false,
    position: 1024,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    commentCount: 0,
    attachmentCount: 0,
    trackedSeconds: 0,
    parentId: undefined,
    parentName: undefined,
    parentNumber: undefined,
    subtasks: [],
  }
}

describe('groupTasksByStatus', () => {
  it('orders the groups by the status order, not the order tasks arrived in', () => {
    const groups = groupTasksByStatus([task('a', TODO), task('b', BACKLOG), task('c', TODO)])

    expect(groups.map((group) => group.status.name)).toEqual(['Backlog', 'To do'])
    expect(groups[1]?.items.map((item) => item.task.id)).toEqual(['a', 'c'])
  })

  it('keeps the move arrows tied to the list order across groups', () => {
    const groups = groupTasksByStatus([task('a', TODO), task('b', BACKLOG), task('c', TODO)])
    const [backlog, todo] = groups

    expect(todo?.items[0]).toMatchObject({ canMoveUp: false, canMoveDown: true })
    expect(backlog?.items[0]).toMatchObject({ canMoveUp: true, canMoveDown: true })
    expect(todo?.items[1]).toMatchObject({ canMoveUp: true, canMoveDown: false })
  })

  it('has no groups without tasks', () => {
    expect(groupTasksByStatus([])).toEqual([])
  })
})
