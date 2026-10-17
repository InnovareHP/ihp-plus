import { createFetchRouter } from '@ihp/rpc'
import { SearchService } from '@ihp/rpc/search'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  member: { findMany: vi.fn() },
  client: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
}))
const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const { search } = await import('./search-routes')

// Only search is mounted, so the wire path is tested without every other feature's graph.
const router = createFetchRouter((routes) => routes.service(SearchService, search))

function call(method: 'GetDirectory' | 'SearchTasks', body: object) {
  return router.handle(
    new Request(`http://localhost/app/api/rpc/ihp.search.v1.SearchService/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

function profileAs(role: 'admin' | 'member') {
  return {
    preferredName: null,
    role: 'user',
    members: [{ role, organizationId: 'org-1', organization: null }],
    teammembers: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  guard.getSession.mockResolvedValue({ user: { id: 'user-1', name: 'Dana Reyes' } })
  guard.readProfile.mockResolvedValue(profileAs('admin'))
  prisma.member.findMany.mockResolvedValue([
    {
      user: {
        id: 'user-2',
        name: 'Grace Hopper',
        preferredName: null,
        jobTitle: 'Recruiter',
        photoKey: null,
        teammembers: [{ team: { name: 'HR' } }],
      },
    },
  ])
  prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Acme', status: 'active' }])
  prisma.task.findMany.mockResolvedValue([
    {
      id: 'task-1',
      taskNumber: 12,
      name: 'Renewal pack',
      projectId: 'project-1',
      project: { name: 'Renewals' },
      status: { name: 'To do', color: '#95E5DC' },
    },
  ])
})

describe('SearchService over the wire', () => {
  it('serves an admin the directory as Connect JSON', async () => {
    const response = await call('GetDirectory', {})

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      people: [{ userId: 'user-2', name: 'Grace Hopper', jobTitle: 'Recruiter', department: 'HR' }],
      clients: [{ clientId: 'client-1', name: 'Acme', status: 'active' }],
    })
  })

  it('serves an admin task matches', async () => {
    const response = await call('SearchTasks', { query: 'renewal' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      tasks: [
        {
          taskId: 'task-1',
          taskNumber: 12,
          name: 'Renewal pack',
          projectId: 'project-1',
          projectName: 'Renewals',
          statusName: 'To do',
          statusColor: '#95E5DC',
        },
      ],
    })
  })

  it('answers a member 403 permission_denied, with no data', async () => {
    guard.readProfile.mockResolvedValue(profileAs('member'))

    const response = await call('GetDirectory', {})

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      code: 'permission_denied',
      message: 'Search is open to admins while it is piloted.',
    })
  })

  it('answers a signed-out caller 401 unauthenticated', async () => {
    guard.getSession.mockResolvedValue(null)

    const response = await call('SearchTasks', { query: 'renewal' })

    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('unauthenticated')
  })

  it('answers a one-letter query 400 invalid_argument', async () => {
    const response = await call('SearchTasks', { query: 'a' })

    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('invalid_argument')
  })
})
