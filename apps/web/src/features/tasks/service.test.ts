import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  taskProject: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  taskList: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  taskStatus: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    createMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  task: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  taskAssignee: { createMany: vi.fn(), deleteMany: vi.fn() },
  taskCommentMention: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  taskComment: { findMany: vi.fn(), create: vi.fn() },
  taskAttachment: { findMany: vi.fn(), updateMany: vi.fn() },
  member: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  $transaction: vi.fn(),
}))

const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))
const activity = vi.hoisted(() => ({ recordActivity: vi.fn(), loadActivity: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/activity', () => activity)
// membershipOf is pure, so the real one is kept: how a membership resolves has one definition.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const {
  createStatus,
  promoteSubtask,
  loadTaskActivity,
  loadMentions,
  markAllMentionsRead,
  markMentionRead,
  createTask,
  deleteList,
  deleteStatus,
  loadConversation,
  loadTasks,
  reorderStatus,
  reorderTask,
  setTaskCompleted,
  updateStatus,
} = await import('./service')

const STATUSES = [
  { id: 'status-todo', name: 'To do', color: '#95E5DC', category: 'active', sortOrder: 1 },
  { id: 'status-done', name: 'Done', color: '#15803d', category: 'done', sortOrder: 2 },
]

const TASK_RECORD = {
  id: 'task-1',
  taskNumber: 7,
  name: 'Send the renewal pack',
  description: null,
  priority: 'normal',
  projectId: 'project-1',
  listId: 'list-1',
  statusId: 'status-todo',
  status: STATUSES[0],
  assignees: [],
  startDate: null,
  dueDate: null,
  completedAt: null,
  isArchived: false,
  position: 1024,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  _count: { comments: 0, attachments: 0 },
  parentId: null,
  subtasks: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  guard.getSession.mockResolvedValue({ user: { id: 'user-1', name: 'Dana Reyes' } })
  guard.readProfile.mockResolvedValue({
    preferredName: 'Dana',
    role: 'user',
    members: [{ role: 'member', organizationId: 'org-1', organization: null }],
    teammembers: [],
  })
  prisma.taskStatus.findMany.mockResolvedValue(STATUSES)
  prisma.taskProject.findFirst.mockResolvedValue({ id: 'project-1', taskCounter: 6 })
  prisma.user.findMany.mockResolvedValue([])
  prisma.$transaction.mockImplementation((run: (tx: typeof prisma) => unknown) => run(prisma))
})

describe('loadTasks', () => {
  it('refuses a project in another organization', async () => {
    prisma.taskProject.findFirst.mockResolvedValue(null)

    await expect(
      loadTasks({
        projectId: 'project-9',
        listId: undefined,
        assignee: 'all',
        search: '',
        includeArchived: false,
      }),
    ).rejects.toMatchObject({ code: Code.NotFound })
  })

  it('narrows to one person, one column and a priority shortlist', async () => {
    prisma.task.findMany.mockResolvedValue([])

    await loadTasks({
      projectId: 'project-1',
      listId: undefined,
      assignee: 'all',
      search: '',
      includeArchived: false,
      assigneeUserId: 'user-2',
      statusId: 'status-todo',
      priorities: ['urgent', 'high'],
      due: 'any',
    })

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignees: { some: { userId: 'user-2' } },
          statusId: 'status-todo',
          priority: { in: ['urgent', 'high'] },
        }),
      }),
    )
  })

  it('counts a task late only while it is still open', async () => {
    prisma.task.findMany.mockResolvedValue([])

    await loadTasks({
      projectId: 'project-1',
      listId: undefined,
      assignee: 'all',
      search: '',
      includeArchived: false,
      due: 'overdue',
    })

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: { lt: expect.any(Date) },
          status: { category: 'active' },
        }),
      }),
    )
  })

  it('asks for the tasks nobody has dated', async () => {
    prisma.task.findMany.mockResolvedValue([])

    await loadTasks({
      projectId: 'project-1',
      listId: undefined,
      assignee: 'all',
      search: '',
      includeArchived: false,
      due: 'none',
    })

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dueDate: null }) }),
    )
  })

  it('filters to the caller when the board asks for their own work', async () => {
    prisma.task.findMany.mockResolvedValue([])

    await loadTasks({
      projectId: 'project-1',
      listId: undefined,
      assignee: 'mine',
      search: '  renewal ',
      includeArchived: false,
    })

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          isArchived: false,
          OR: [
            { name: { contains: 'renewal', mode: 'insensitive' } },
            { description: { contains: 'renewal', mode: 'insensitive' } },
            { comments: { some: { body: { contains: 'renewal', mode: 'insensitive' } } } },
          ],
          assignees: { some: { userId: 'user-1' } },
          // Subtasks hang off their parent's panel, never a board row of their own.
          parentId: null,
        }),
      }),
    )
  })
})

describe('reorderTask', () => {
  beforeEach(() => {
    prisma.task.findFirst.mockResolvedValue({ ...TASK_RECORD, completedAt: null })
    prisma.taskList.findFirst.mockResolvedValue({ id: 'list-1' })
    prisma.task.findMany.mockResolvedValue([
      { id: 'task-2', position: 1024 },
      { id: 'task-3', position: 2048 },
    ])
    prisma.task.update.mockResolvedValue(TASK_RECORD)
  })

  it('drops a card into a column and a place in it with one write', async () => {
    prisma.taskStatus.findFirst.mockResolvedValue({ id: 'status-done', category: 'done' })

    await reorderTask({
      taskId: 'task-1',
      listId: 'list-1',
      beforeTaskId: 'task-3',
      statusId: 'status-done',
    })

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listId: 'list-1',
          position: (1024 + 2048) / 2,
          statusId: 'status-done',
          completedAt: expect.any(Date),
        }),
      }),
    )
  })

  it('orders against the list, not the subtasks inside it', async () => {
    await reorderTask({ taskId: 'task-1', listId: 'list-1', beforeTaskId: undefined })

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ listId: 'list-1', parentId: null }),
      }),
    )
  })

  it('refuses a column that is no longer there', async () => {
    prisma.taskStatus.findFirst.mockResolvedValue(null)

    await expect(
      reorderTask({
        taskId: 'task-1',
        listId: 'list-1',
        beforeTaskId: undefined,
        statusId: 'status-gone',
      }),
    ).rejects.toMatchObject({ code: Code.NotFound })
  })
})

describe('loadTaskActivity', () => {
  it('checks the caller may see the task before handing over its history', async () => {
    prisma.task.findFirst.mockResolvedValue(null)

    await expect(loadTaskActivity('task-9')).rejects.toMatchObject({ code: Code.NotFound })
    expect(activity.loadActivity).not.toHaveBeenCalled()
  })

  it('reads the history of that task alone', async () => {
    prisma.task.findFirst.mockResolvedValue(TASK_RECORD)
    activity.loadActivity.mockResolvedValue([])

    await loadTaskActivity('task-1')

    expect(activity.loadActivity).toHaveBeenCalledWith('org-1', 'task', 'task-1')
  })
})

describe('mentions', () => {
  const MENTION = {
    readAt: null,
    comment: {
      id: 'comment-1',
      body: '  Can you confirm\n the figures?  ',
      authorId: 'user-2',
      createdAt: new Date('2026-09-20T09:00:00.000Z'),
      task: { id: 'task-1', taskNumber: 14, name: 'Send the renewal pack', projectId: 'project-1' },
    },
  }

  beforeEach(() => {
    prisma.taskCommentMention.findMany.mockResolvedValue([MENTION])
    prisma.taskCommentMention.count.mockResolvedValue(3)
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-2', name: 'Grace Hopper', preferredName: null },
    ])
  })

  it('counts every unread one, not just the page it returns', async () => {
    const feed = await loadMentions(true)

    expect(feed.unreadCount).toBe(3)
    expect(feed.mentions).toHaveLength(1)
    expect(feed.mentions[0]).toMatchObject({
      authorName: 'Grace Hopper',
      excerpt: 'Can you confirm the figures?',
      isRead: false,
      taskNumber: 14,
    })
  })

  it("reads only the caller's own organization", async () => {
    await loadMentions(false)

    expect(prisma.taskCommentMention.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          readAt: null,
          comment: { organizationId: 'org-1' },
        }),
      }),
    )
  })

  it('marks one read as the person it named, nobody else', async () => {
    await markMentionRead('comment-1', true)

    expect(prisma.taskCommentMention.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ commentId: 'comment-1', userId: 'user-1' }),
        data: { readAt: expect.any(Date) },
      }),
    )
  })

  it('clears the badge in one write', async () => {
    await markAllMentionsRead()

    expect(prisma.taskCommentMention.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', readAt: null }),
        data: { readAt: expect.any(Date) },
      }),
    )
  })
})

describe('deleteList', () => {
  it('refuses a list that still holds work', async () => {
    prisma.taskList.findFirst.mockResolvedValue({
      id: 'list-1',
      projectId: 'project-1',
      _count: { tasks: 3 },
    })

    await expect(deleteList('list-1')).rejects.toMatchObject({ code: Code.FailedPrecondition })
    expect(prisma.taskList.delete).not.toHaveBeenCalled()
  })

  it('refuses the last list of a project, which could then hold nothing', async () => {
    prisma.taskList.findFirst.mockResolvedValue({
      id: 'list-1',
      projectId: 'project-1',
      _count: { tasks: 0 },
    })
    prisma.taskList.count.mockResolvedValue(1)

    await expect(deleteList('list-1')).rejects.toMatchObject({ code: Code.FailedPrecondition })
  })

  it('deletes an empty list beside others', async () => {
    prisma.taskList.findFirst.mockResolvedValue({
      id: 'list-2',
      projectId: 'project-1',
      _count: { tasks: 0 },
    })
    prisma.taskList.count.mockResolvedValue(2)

    await deleteList('list-2')

    expect(prisma.taskList.delete).toHaveBeenCalledWith({ where: { id: 'list-2' } })
  })
})

describe('statuses', () => {
  beforeEach(() => {
    prisma.taskStatus.findMany.mockResolvedValue(STATUSES)
    prisma.taskStatus.findFirst.mockResolvedValue(STATUSES[0])
  })

  it('refuses a second column with the same name', async () => {
    await expect(
      createStatus({ name: 'to do', color: '#95E5DC', category: 'active' }),
    ).rejects.toMatchObject({ code: Code.AlreadyExists })
  })

  it('numbers a new column after the ones already there', async () => {
    prisma.taskStatus.create.mockResolvedValue({
      id: 'status-review',
      name: 'In review',
      color: '#0B286B',
      category: 'active',
      sortOrder: 3,
    })

    await createStatus({ name: 'In review', color: '#0B286B', category: 'active' })

    expect(prisma.taskStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sortOrder: 3 }) }),
    )
  })

  it('renumbers every column on a move, so the order cannot drift', async () => {
    prisma.taskStatus.findFirst.mockResolvedValue(STATUSES[1])
    prisma.$transaction.mockResolvedValue([])

    await reorderStatus('status-done', 'status-todo')

    expect(prisma.taskStatus.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'status-done' },
      data: { sortOrder: 1 },
    })
    expect(prisma.taskStatus.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'status-todo' },
      data: { sortOrder: 2 },
    })
  })

  it('will not delete the last column of its category', async () => {
    await expect(deleteStatus('status-todo')).rejects.toMatchObject({
      code: Code.FailedPrecondition,
    })
  })

  it('asks where the work goes before deleting a column that holds any', async () => {
    prisma.taskStatus.findMany.mockResolvedValue([
      ...STATUSES,
      {
        id: 'status-doing',
        name: 'In progress',
        color: '#1346C5',
        category: 'active',
        sortOrder: 3,
      },
    ])
    prisma.task.count.mockResolvedValue(2)

    await expect(deleteStatus('status-todo')).rejects.toMatchObject({
      code: Code.FailedPrecondition,
    })
    expect(prisma.taskStatus.delete).not.toHaveBeenCalled()
  })

  it('moves the work across, then deletes the column', async () => {
    prisma.taskStatus.findMany.mockResolvedValue([
      ...STATUSES,
      {
        id: 'status-doing',
        name: 'In progress',
        color: '#1346C5',
        category: 'active',
        sortOrder: 3,
      },
    ])
    prisma.task.count.mockResolvedValue(2)

    await deleteStatus('status-todo', 'status-doing')

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { statusId: 'status-todo' },
      data: { statusId: 'status-doing', completedAt: null },
    })
    expect(prisma.taskStatus.delete).toHaveBeenCalledWith({ where: { id: 'status-todo' } })
  })

  it('renames a column without touching the work in it', async () => {
    prisma.taskStatus.update.mockResolvedValue({ ...STATUSES[0], name: 'Up next' })

    const row = await updateStatus({ statusId: 'status-todo', name: '  Up next  ' })

    expect(prisma.taskStatus.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Up next' } }),
    )
    expect(row.name).toBe('Up next')
  })
})

describe('promoteSubtask', () => {
  it('refuses a task that is not a subtask', async () => {
    prisma.task.findFirst.mockResolvedValue({ ...TASK_RECORD, parentId: null })

    await expect(promoteSubtask('task-1')).rejects.toMatchObject({
      code: Code.FailedPrecondition,
    })
  })

  it('lands it at the end of the list it was already in', async () => {
    prisma.task.findFirst.mockResolvedValue({ ...TASK_RECORD, parentId: 'task-parent' })
    prisma.task.aggregate.mockResolvedValue({ _max: { position: 3072 } })
    prisma.task.update.mockResolvedValue(TASK_RECORD)

    await promoteSubtask('task-1')

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { parentId: null, position: 3072 + 1024 },
      }),
    )
  })
})

describe('reorderTask, inside a parent', () => {
  it('orders a subtask against its siblings, not against the list', async () => {
    prisma.task.findFirst.mockResolvedValue({ ...TASK_RECORD, parentId: 'task-parent' })
    prisma.taskList.findFirst.mockResolvedValue({ id: 'list-1' })
    prisma.task.findMany.mockResolvedValue([{ id: 'sub-2', position: 1024 }])
    prisma.task.update.mockResolvedValue(TASK_RECORD)

    await reorderTask({ taskId: 'task-1', listId: 'list-1', beforeTaskId: 'sub-2' })

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentId: 'task-parent', id: { not: 'task-1' } },
      }),
    )
  })
})

describe('createTask', () => {
  beforeEach(() => {
    prisma.taskList.findFirst.mockResolvedValue({ id: 'list-1' })
    prisma.taskProject.update.mockResolvedValue({ taskCounter: 7 })
    prisma.task.aggregate.mockResolvedValue({ _max: { position: 2048 } })
    prisma.task.create.mockResolvedValue(TASK_RECORD)
  })

  it('numbers the task from the project counter and appends it to the list', async () => {
    const row = await createTask({
      projectId: 'project-1',
      listId: 'list-1',
      name: 'Send the renewal pack',
      description: '',
      priority: 'normal',
      startDate: '',
      dueDate: '',
      assigneeIds: [],
      parentId: '',
    })

    expect(prisma.taskProject.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { taskCounter: { increment: 1 } } }),
    )
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskNumber: 7,
          position: 2048 + 1024,
          statusId: 'status-todo',
        }),
      }),
    )
    expect(activity.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'task.created', subjectType: 'task' }),
    )
    expect(row.taskNumber).toBe(7)
  })

  it('files a subtask in the list its parent lives in', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      projectId: 'project-1',
      listId: 'list-9',
      parentId: null,
    })

    await createTask({
      projectId: 'project-1',
      listId: 'list-1',
      name: 'Draft the cover letter',
      description: '',
      priority: 'normal',
      startDate: '',
      dueDate: '',
      assigneeIds: [],
      parentId: 'task-1',
    })

    // The list the client sent is ignored: a subtask lives wherever its parent does.
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentId: 'task-1', listId: 'list-9' }),
      }),
    )
    expect(prisma.task.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentId: 'task-1' } }),
    )
  })

  it('refuses a subtask of a subtask, because the board cannot draw a tree', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-2',
      projectId: 'project-1',
      listId: 'list-1',
      parentId: 'task-1',
    })

    await expect(
      createTask({
        projectId: 'project-1',
        listId: 'list-1',
        name: 'Draft the cover letter',
        description: '',
        priority: 'normal',
        startDate: '',
        dueDate: '',
        assigneeIds: [],
        parentId: 'task-2',
      }),
    ).rejects.toMatchObject({ code: Code.FailedPrecondition })
  })

  it('refuses an assignee who is not in the organization', async () => {
    prisma.member.findMany.mockResolvedValue([])

    await expect(
      createTask({
        projectId: 'project-1',
        listId: 'list-1',
        name: 'Send the renewal pack',
        description: '',
        priority: 'normal',
        startDate: '',
        dueDate: '',
        assigneeIds: ['user-outside'],
        parentId: '',
      }),
    ).rejects.toBeInstanceOf(ConnectError)
    expect(prisma.task.create).not.toHaveBeenCalled()
  })
})

describe('setTaskCompleted', () => {
  it('moves the task into the done status and stamps when', async () => {
    prisma.task.findFirst.mockResolvedValue(TASK_RECORD)
    prisma.task.update.mockResolvedValue({
      ...TASK_RECORD,
      statusId: 'status-done',
      status: STATUSES[1],
      completedAt: new Date('2026-09-17T00:00:00.000Z'),
    })

    const row = await setTaskCompleted('task-1', true)

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusId: 'status-done' }),
      }),
    )
    expect(row.completedAt).toBe('2026-09-17T00:00:00.000Z')
    expect(activity.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'task.completed' }),
    )
  })
})

describe('reorderTask', () => {
  beforeEach(() => {
    prisma.task.findFirst.mockResolvedValue(TASK_RECORD)
    prisma.taskList.findFirst.mockResolvedValue({ id: 'list-1' })
    prisma.task.update.mockResolvedValue(TASK_RECORD)
  })

  it('drops the task halfway between its new neighbours', async () => {
    prisma.task.findMany.mockResolvedValue([
      { id: 'task-2', position: 1000 },
      { id: 'task-3', position: 2000 },
    ])

    await reorderTask({ taskId: 'task-1', listId: 'list-1', beforeTaskId: 'task-3' })

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { listId: 'list-1', position: 1500 } }),
    )
  })

  it('renormalizes the list when the neighbours are too close to halve', async () => {
    prisma.task.findMany.mockResolvedValue([
      { id: 'task-2', position: 1000 },
      { id: 'task-3', position: 1000.0000001 },
    ])

    await reorderTask({ taskId: 'task-1', listId: 'list-1', beforeTaskId: 'task-3' })

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-2' }, data: { position: 1024 } }),
    )
    expect(prisma.task.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { listId: 'list-1', position: 2048 } }),
    )
  })

  it('refuses a row that moved out from under the drop', async () => {
    prisma.task.findMany.mockResolvedValue([{ id: 'task-2', position: 1000 }])

    await expect(
      reorderTask({ taskId: 'task-1', listId: 'list-1', beforeTaskId: 'gone' }),
    ).rejects.toMatchObject({ code: Code.Aborted })
  })
})

describe('loadConversation', () => {
  beforeEach(() => {
    prisma.task.findFirst.mockResolvedValue(TASK_RECORD)
    prisma.taskComment.findMany.mockResolvedValue([])
    prisma.taskAttachment.findMany.mockResolvedValue([])
  })

  it('reads only the files a comment claimed', async () => {
    await loadConversation('task-1')

    // An unclaimed row is an upload whose comment never posted, not something anyone said.
    expect(prisma.taskAttachment.findMany.mock.calls[0]?.[0].where).toMatchObject({
      taskId: 'task-1',
      commentId: { not: null },
    })
  })

  it('hands each file back inside the comment it was posted in', async () => {
    prisma.taskComment.findMany.mockResolvedValue([
      {
        id: 'comment-1',
        taskId: 'task-1',
        authorId: 'user-1',
        body: 'Here it is.',
        editedAt: null,
        createdAt: new Date('2026-09-02T00:00:00.000Z'),
        mentions: [],
        attachments: [],
      },
    ])
    prisma.taskAttachment.findMany.mockResolvedValue([
      {
        id: 'file-1',
        fileKey: 'org-1/task-1/renewal.pdf',
        fileName: 'renewal.pdf',
        contentType: 'application/pdf',
        fileSize: 2048,
        uploadedById: 'user-1',
        commentId: 'comment-1',
        createdAt: new Date('2026-09-02T00:00:00.000Z'),
      },
    ])

    const conversation = await loadConversation('task-1')

    expect(conversation.comments[0]?.attachments.map((file) => file.id)).toEqual(['file-1'])
  })
})
