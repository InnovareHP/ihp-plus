import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  newHireChecklist: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  newHireDocument: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  newHireTask: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  newHireTaskCompletion: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  user: { findMany: vi.fn() },
  attendanceSchedule: { findMany: vi.fn() },
  bluebookAcknowledgement: { findMany: vi.fn() },
  bluebookDocument: { findFirst: vi.fn(), findMany: vi.fn() },
}))

vi.mock('@ihp/db', () => ({ db: prisma }))

const {
  addRequiredDocument,
  closeChecklist,
  listNewHires,
  loadChecklistFor,
  setTaskDone,
  startChecklist,
} = await import('./service')

const ADA = {
  id: 'user-ada',
  name: 'Ada Lovelace',
  preferredName: 'Ada',
  jobTitle: 'Data Analyst',
  phone: '+63 917 000 0000',
  photoKey: 'photos/ada.jpg',
  teammembers: [{ team: { id: 'team-it', name: 'IT' } }],
}

const HANDBOOK = { document: { id: 'doc-handbook', title: 'Handbook', teams: [] } }
const LAPTOP = { id: 'task-laptop', title: 'Collect your laptop', description: null }

function settledAda() {
  prisma.user.findMany.mockResolvedValue([ADA])
  prisma.attendanceSchedule.findMany.mockResolvedValue([
    { userId: 'user-ada', shift: { name: 'Morning' } },
  ])
  prisma.bluebookAcknowledgement.findMany.mockResolvedValue([
    { userId: 'user-ada', documentId: 'doc-handbook' },
  ])
  prisma.newHireTaskCompletion.findMany.mockResolvedValue([
    { userId: 'user-ada', taskId: 'task-laptop' },
  ])
}

beforeEach(() => {
  vi.resetAllMocks()
  prisma.newHireDocument.findMany.mockResolvedValue([HANDBOOK])
  prisma.newHireTask.findMany.mockResolvedValue([LAPTOP])
  prisma.newHireChecklist.updateMany.mockResolvedValue({ count: 1 })
})

describe('startChecklist', () => {
  it('starts one checklist per hire, however often setup finishes', async () => {
    await startChecklist('org-1', 'user-ada')

    expect(prisma.newHireChecklist.upsert).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: 'org-1', userId: 'user-ada' } },
      create: { organizationId: 'org-1', userId: 'user-ada' },
      update: {},
    })
  })
})

describe('loadChecklistFor', () => {
  it('returns nothing for someone who is not a new hire', async () => {
    prisma.newHireChecklist.findUnique.mockResolvedValue(null)

    expect(await loadChecklistFor('org-1', 'user-ada')).toBeNull()
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('shows what is left and leaves an unfinished checklist open', async () => {
    prisma.newHireChecklist.findUnique.mockResolvedValue({
      startedAt: new Date('2026-09-20T00:00:00Z'),
      completedAt: null,
    })
    prisma.user.findMany.mockResolvedValue([{ ...ADA, phone: null }])
    prisma.attendanceSchedule.findMany.mockResolvedValue([])
    prisma.bluebookAcknowledgement.findMany.mockResolvedValue([])
    prisma.newHireTaskCompletion.findMany.mockResolvedValue([])

    const view = await loadChecklistFor('org-1', 'user-ada')

    expect(view?.profile).toEqual({ done: false, missing: ['phone'] })
    expect(view?.reading.documents).toEqual([
      { id: 'doc-handbook', title: 'Handbook', acknowledged: false },
    ])
    expect(view?.shift.done).toBe(false)
    expect(view?.completedAt).toBeUndefined()
    expect(prisma.newHireChecklist.updateMany).not.toHaveBeenCalled()
  })

  it('stamps the checklist complete the first time every step is done', async () => {
    prisma.newHireChecklist.findUnique.mockResolvedValue({
      startedAt: new Date('2026-09-20T00:00:00Z'),
      completedAt: null,
    })
    settledAda()

    const view = await loadChecklistFor('org-1', 'user-ada')

    expect(view?.completedAt).toBeDefined()
    expect(prisma.newHireChecklist.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: { in: ['user-ada'] }, completedAt: null }),
      }),
    )
  })
})

describe('listNewHires', () => {
  it('says where each hire is stuck and who they are', async () => {
    prisma.newHireChecklist.findMany.mockResolvedValue([
      {
        userId: 'user-ada',
        startedAt: new Date('2026-09-20T00:00:00Z'),
        completedAt: null,
        closedById: null,
      },
    ])
    prisma.user.findMany.mockResolvedValue([ADA])
    prisma.attendanceSchedule.findMany.mockResolvedValue([])
    prisma.bluebookAcknowledgement.findMany.mockResolvedValue([
      { userId: 'user-ada', documentId: 'doc-handbook' },
    ])
    prisma.newHireTaskCompletion.findMany.mockResolvedValue([])

    const [row] = await listNewHires('org-1')

    expect(row).toMatchObject({
      userId: 'user-ada',
      name: 'Ada',
      teamName: 'IT',
      doneCount: 2,
      stuckOn: 'shift',
      closedByAdmin: false,
    })
  })

  it('stamps a hire who has just finished, so the list shows them complete', async () => {
    prisma.newHireChecklist.findMany.mockResolvedValue([
      {
        userId: 'user-ada',
        startedAt: new Date('2026-09-20T00:00:00Z'),
        completedAt: null,
        closedById: null,
      },
    ])
    settledAda()

    const [row] = await listNewHires('org-1')

    expect(row?.completedAt).toBeDefined()
    expect(row?.stuckOn).toBeUndefined()
  })
})

describe('setTaskDone', () => {
  it('refuses a task that is not on this organization list', async () => {
    prisma.newHireTask.findFirst.mockResolvedValue(null)

    expect(await setTaskDone('org-1', 'user-ada', 'task-other', true)).toBe(false)
    expect(prisma.newHireTaskCompletion.upsert).not.toHaveBeenCalled()
  })

  it('ticks a task off, and unticking takes the record away', async () => {
    prisma.newHireTask.findFirst.mockResolvedValue({ id: 'task-laptop' })

    expect(await setTaskDone('org-1', 'user-ada', 'task-laptop', true)).toBe(true)
    expect(prisma.newHireTaskCompletion.upsert).toHaveBeenCalled()

    expect(await setTaskDone('org-1', 'user-ada', 'task-laptop', false)).toBe(true)
    expect(prisma.newHireTaskCompletion.deleteMany).toHaveBeenCalledWith({
      where: { taskId: 'task-laptop', userId: 'user-ada' },
    })
  })
})

describe('closeChecklist', () => {
  it('records which admin closed it', async () => {
    expect(await closeChecklist('org-1', 'user-ada', 'user-admin')).toBe(true)
    expect(prisma.newHireChecklist.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'user-ada', completedAt: null },
      data: expect.objectContaining({ closedById: 'user-admin' }),
    })
  })
})

describe('addRequiredDocument', () => {
  it('refuses a document from another organization', async () => {
    prisma.bluebookDocument.findFirst.mockResolvedValue(null)

    expect(await addRequiredDocument('org-1', 'doc-elsewhere')).toBe(false)
    expect(prisma.newHireDocument.upsert).not.toHaveBeenCalled()
  })
})
