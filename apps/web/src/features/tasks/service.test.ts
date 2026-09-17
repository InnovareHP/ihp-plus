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
  taskList: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  taskStatus: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn() },
  task: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  taskAssignee: { createMany: vi.fn(), deleteMany: vi.fn() },
  member: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  $transaction: vi.fn(),
}))

const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))
const activity = vi.hoisted(() => ({ recordActivity: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/activity', () => activity)
// membershipOf is pure, so the real one is kept: how a membership resolves has one definition.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const { createTask, loadTasks, reorderTask, setTaskCompleted } = await import('./service')

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
          name: { contains: 'renewal', mode: 'insensitive' },
          assignees: { some: { userId: 'user-1' } },
        }),
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
      dueDate: '',
      assigneeIds: [],
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

  it('refuses an assignee who is not in the organization', async () => {
    prisma.member.findMany.mockResolvedValue([])

    await expect(
      createTask({
        projectId: 'project-1',
        listId: 'list-1',
        name: 'Send the renewal pack',
        description: '',
        priority: 'normal',
        dueDate: '',
        assigneeIds: ['user-outside'],
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
