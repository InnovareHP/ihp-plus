import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  member: { findMany: vi.fn() },
  client: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
}))
const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
// membershipOf and canManageOrganization are pure, so the real ones decide who is an admin.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const { loadSearchDirectory, searchTasks } = await import('./service')

function profileAs(role: 'owner' | 'admin' | 'member', portalRole = 'user') {
  return {
    preferredName: null,
    role: portalRole,
    members: [{ role, organizationId: 'org-1', organization: null }],
    teammembers: [],
  }
}

function taskRecord(id: string, taskNumber: number, name: string) {
  return {
    id,
    taskNumber,
    name,
    projectId: 'project-1',
    project: { name: 'Renewals' },
    status: { name: 'To do', color: '#95E5DC' },
  }
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error instanceof ConnectError ? error.code : error
  }
  return 'resolved'
}

beforeEach(() => {
  vi.clearAllMocks()
  guard.getSession.mockResolvedValue({ user: { id: 'user-1', name: 'Dana Reyes' } })
  guard.readProfile.mockResolvedValue(profileAs('admin'))
  prisma.member.findMany.mockResolvedValue([])
  prisma.client.findMany.mockResolvedValue([])
  prisma.task.findMany.mockResolvedValue([])
})

describe('search access', () => {
  it('answers a signed-out caller with unauthenticated', async () => {
    guard.getSession.mockResolvedValue(null)

    expect(await codeOf(loadSearchDirectory())).toBe(Code.Unauthenticated)
    expect(await codeOf(searchTasks({ query: 'renewal', limit: 0 }))).toBe(Code.Unauthenticated)
  })

  it('denies an ordinary member while search is piloted with admins', async () => {
    guard.readProfile.mockResolvedValue(profileAs('member'))

    expect(await codeOf(loadSearchDirectory())).toBe(Code.PermissionDenied)
    expect(await codeOf(searchTasks({ query: 'renewal', limit: 0 }))).toBe(Code.PermissionDenied)
    expect(prisma.member.findMany).not.toHaveBeenCalled()
    expect(prisma.task.findMany).not.toHaveBeenCalled()
  })

  it('lets an owner, an admin and a portal admin through', async () => {
    for (const profile of [profileAs('owner'), profileAs('admin'), profileAs('member', 'admin')]) {
      guard.readProfile.mockResolvedValue(profile)
      expect(await codeOf(loadSearchDirectory())).toBe('resolved')
    }
  })

  it('asks someone with no organization to finish setting up first', async () => {
    guard.readProfile.mockResolvedValue({ ...profileAs('admin'), members: [] })

    expect(await codeOf(loadSearchDirectory())).toBe(Code.FailedPrecondition)
  })
})

describe('loadSearchDirectory', () => {
  it('lists people and clients from the caller’s organization only', async () => {
    prisma.member.findMany.mockResolvedValue([
      {
        user: {
          id: 'user-2',
          name: 'Grace Hopper',
          preferredName: 'Grace',
          jobTitle: 'Recruiter',
          photoKey: null,
          teammembers: [{ team: { name: 'HR' } }],
        },
      },
      {
        user: {
          id: 'user-3',
          name: 'Zoe Park',
          preferredName: null,
          jobTitle: null,
          photoKey: null,
          teammembers: [],
        },
      },
    ])
    prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Acme', status: 'active' }])

    expect(await loadSearchDirectory()).toEqual({
      people: [
        { userId: 'user-2', name: 'Grace', jobTitle: 'Recruiter', department: 'HR', photoUrl: '' },
        { userId: 'user-3', name: 'Zoe Park', jobTitle: '', department: '', photoUrl: '' },
      ],
      clients: [{ clientId: 'client-1', name: 'Acme', status: 'active' }],
    })
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          user: { onboardingCompletedAt: { not: null }, OR: [{ banned: false }, { banned: null }] },
        },
      }),
    )
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1', archivedAt: null } }),
    )
  })

  it('never selects contact or pay details', async () => {
    await loadSearchDirectory()

    const select = prisma.member.findMany.mock.calls[0]?.[0].select.user.select
    for (const field of ['email', 'phone', 'dateOfBirth', 'ihpId']) {
      expect(select).not.toHaveProperty(field)
    }
  })
})

describe('searchTasks', () => {
  it('rejects a query shorter than 2 or longer than 100 characters', async () => {
    expect(await codeOf(searchTasks({ query: ' a ', limit: 0 }))).toBe(Code.InvalidArgument)
    expect(await codeOf(searchTasks({ query: 'x'.repeat(101), limit: 0 }))).toBe(
      Code.InvalidArgument,
    )
    expect(prisma.task.findMany).not.toHaveBeenCalled()
  })

  it('searches live tasks in live projects of the caller’s organization', async () => {
    await searchTasks({ query: 'renewal', limit: 0 })

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          isArchived: false,
          project: { isArchived: false },
          OR: [{ name: { contains: 'renewal', mode: 'insensitive' } }],
        },
      }),
    )
  })

  it('also matches the task number for "#12" or "12"', async () => {
    await searchTasks({ query: '#12', limit: 0 })

    expect(prisma.task.findMany.mock.calls[0]?.[0].where.OR).toEqual([
      { name: { contains: '#12', mode: 'insensitive' } },
      { taskNumber: 12 },
    ])
  })

  it('returns the best matches first, capped at the default of 8', async () => {
    prisma.task.findMany.mockResolvedValue([
      ...Array.from({ length: 9 }, (_, index) =>
        taskRecord(`t${index}`, index + 20, 'Call about renewal'),
      ),
      taskRecord('starts', 3, 'Renewal pack'),
    ])

    const tasks = await searchTasks({ query: 'renewal', limit: 0 })

    expect(tasks).toHaveLength(8)
    expect(tasks[0]).toEqual({
      taskId: 'starts',
      taskNumber: 3,
      name: 'Renewal pack',
      projectId: 'project-1',
      projectName: 'Renewals',
      statusName: 'To do',
      statusColor: '#95E5DC',
    })
  })
})
