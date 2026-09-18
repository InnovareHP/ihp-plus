import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memberQuerySchema } from './schema'

const prisma = vi.hoisted(() => ({
  member: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  team: { findMany: vi.fn() },
  user: { update: vi.fn() },
  lookupOption: { findMany: vi.fn(), findFirst: vi.fn() },
}))

const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))
const authApi = vi.hoisted(() => ({ setRole: vi.fn(), banUser: vi.fn(), unbanUser: vi.fn() }))
const notifications = vi.hoisted(() => ({
  notifyRoleChanged: vi.fn(),
  notifyAccessChanged: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
// membershipOf and canManageOrganization are pure, so the real ones are kept: the manager
// rule has one definition and this test exercises it rather than a copy.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))
vi.mock('@/lib/auth', () => ({ auth: { api: authApi } }))
vi.mock('./notifications', () => notifications)
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))

const {
  applyEmploymentStatus,
  applyMemberAccess,
  applyPortalRole,
  loadFilterOptions,
  loadMembersPage,
} = await import('./service')

// The service takes a parsed query; turning URL params into one is the caller's job.
const listMembers = (query: Record<string, unknown> = {}) =>
  loadMembersPage(memberQuerySchema.parse(query))
const listMemberFilterOptions = () => loadFilterOptions()

async function codeOf(operation: () => Promise<unknown>) {
  const error = await operation().catch((thrown: unknown) => thrown)
  return ConnectError.from(error).code
}

const ROW = {
  id: 'member-1',
  role: 'member',
  user: {
    id: 'user-1',
    name: 'Ada Lovelace',
    email: 'ada@innovarehp.com',
    role: null,
    banned: null,
    jobTitle: 'Software Engineer',
    ihpId: 'IHP-0001',
    employmentStatus: 'Probationary',
    startDate: new Date('2026-03-04T00:00:00.000Z'),
    teammembers: [{ team: { name: 'Information Technology' } }],
  },
}

function signedInAs(options: { portalRole?: string; organizationRole?: string } = {}) {
  guard.getSession.mockResolvedValue({ user: { id: 'user-9' } })
  guard.readProfile.mockResolvedValue({
    role: options.portalRole ?? 'admin',
    members: [{ role: options.organizationRole ?? 'admin', organizationId: 'org-1' }],
    teammembers: [],
  })
}

/** The `where.user.AND` clauses the service handed Prisma. */
async function clausesFor(query: Record<string, unknown>) {
  await listMembers(query)
  const args = prisma.member.findMany.mock.calls.at(-1)?.[0]
  return { args, clauses: args?.where?.user?.AND ?? [] }
}

describe('loadMembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs()
    prisma.member.count.mockResolvedValue(1)
    prisma.member.findMany.mockResolvedValue([ROW])
  })

  it('refuses an ordinary member without touching the table', async () => {
    signedInAs({ portalRole: 'user', organizationRole: 'member' })

    await expect(listMembers({})).rejects.toThrow(/permission to manage members/)
    expect(await codeOf(() => listMembers({}))).toBe(Code.PermissionDenied)
    expect(prisma.member.findMany).not.toHaveBeenCalled()
  })

  it('scopes to the caller organization and pages with a stable tiebreaker', async () => {
    const { args } = await clausesFor({})

    expect(args.where).toEqual({ organizationId: 'org-1', user: undefined })
    expect(args.orderBy).toEqual([{ user: { name: 'asc' } }, { id: 'asc' }])
    expect(args).toMatchObject({ skip: 0, take: 25 })
  })

  it('maps a row, defaulting the portal role and the never-banned flag', async () => {
    const result = await listMembers({})

    expect(result).toMatchObject({
      rows: [
        {
          memberId: 'member-1',
          userId: 'user-1',
          organizationRole: 'member',
          portalRole: 'user',
          team: 'Information Technology',
          ihpId: 'IHP-0001',
          startDate: '2026-03-04T00:00:00.000Z',
          banned: false,
          isSelf: false,
        },
      ],
      pageInfo: { page: 1, pageSize: 25, total: 1, pageCount: 1 },
    })
  })

  it('searches the name, email, job title and company id at once', async () => {
    const { clauses } = await clausesFor({ search: 'ada' })

    expect(clauses).toEqual([
      {
        OR: [
          { name: { contains: 'ada', mode: 'insensitive' } },
          { email: { contains: 'ada', mode: 'insensitive' } },
          { jobTitle: { contains: 'ada', mode: 'insensitive' } },
          { ihpId: { contains: 'ada', mode: 'insensitive' } },
        ],
      },
    ])
  })

  it('treats a null portal role as an ordinary member when filtering', async () => {
    const { clauses } = await clausesFor({ portalRoles: 'user' })

    expect(clauses).toEqual([{ OR: [{ role: { in: ['user'] } }, { role: null }] }])
  })

  it('counts a never-banned account as active', async () => {
    expect((await clausesFor({ status: 'active' })).clauses).toEqual([
      { OR: [{ banned: false }, { banned: null }] },
    ])
    expect((await clausesFor({ status: 'suspended' })).clauses).toEqual([{ banned: true }])
  })

  it('filters by department, employment type and start-date window together', async () => {
    const { clauses } = await clausesFor({
      teamIds: 'team-1,team-2',
      employmentTypes: 'Full-time',
      startDateFrom: '2026-01-01',
      startDateTo: '2026-06-30',
    })

    expect(clauses).toEqual([
      { employmentType: { in: ['Full-time'] } },
      { teammembers: { some: { teamId: { in: ['team-1', 'team-2'] } } } },
      {
        startDate: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          // Inclusive: a start date on the last day of the window still matches.
          lte: new Date('2026-06-30T23:59:59.999Z'),
        },
      },
    ])
  })

  it('filters by employment status, which is curated per organization', async () => {
    const { clauses } = await clausesFor({ employmentStatuses: 'Probationary,Regular' })

    expect(clauses).toEqual([{ employmentStatus: { in: ['Probationary', 'Regular'] } }])
  })

  it('carries the employment status onto the row', async () => {
    const page = await listMembers({})

    expect(page.rows[0]).toMatchObject({ employmentStatus: 'Probationary' })
  })

  it('sorts by a column on the user row', async () => {
    const { args } = await clausesFor({ sortBy: 'startDate', sortDirection: 'desc' })

    expect(args.orderBy).toEqual([{ user: { startDate: 'desc' } }, { id: 'asc' }])
  })

  it('serves the last page when the requested one is past the end', async () => {
    prisma.member.count.mockResolvedValue(30)

    const result = await listMembers({ page: 99, pageSize: 25 })

    expect(prisma.member.findMany.mock.calls.at(-1)?.[0]).toMatchObject({ skip: 25, take: 25 })
    expect(result).toMatchObject({ pageInfo: { page: 2, pageCount: 2, hasNext: false } })
  })
})

describe('applyEmploymentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs()
    prisma.member.findFirst.mockResolvedValue(ROW)
    prisma.lookupOption.findFirst.mockResolvedValue({ id: 'option-1' })
  })

  it('saves a status the organization keeps', async () => {
    await applyEmploymentStatus({ userId: 'user-1', employmentStatus: 'Regular' })

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { employmentStatus: 'Regular' },
    })
  })

  it('refuses a status that is not on the organization list', async () => {
    prisma.lookupOption.findFirst.mockResolvedValue(null)

    expect(
      await codeOf(() => applyEmploymentStatus({ userId: 'user-1', employmentStatus: 'Tenured' })),
    ).toBe(Code.InvalidArgument)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('clears the status on an empty value without checking the list', async () => {
    await applyEmploymentStatus({ userId: 'user-1', employmentStatus: '' })

    expect(prisma.lookupOption.findFirst).not.toHaveBeenCalled()
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { employmentStatus: null },
    })
  })

  it('refuses someone outside the organization', async () => {
    prisma.member.findFirst.mockResolvedValue(null)

    expect(
      await codeOf(() => applyEmploymentStatus({ userId: 'user-x', employmentStatus: 'Regular' })),
    ).toBe(Code.NotFound)
  })
})

describe('loadFilterOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs()
    prisma.team.findMany.mockResolvedValue([
      { id: 'team-1', name: 'Executive', _count: { teammembers: 3 } },
    ])
    prisma.lookupOption.findMany.mockResolvedValue([
      { value: 'Full-time', sortOrder: 0 },
      { value: 'Contract', sortOrder: 1 },
    ])
  })

  it('serves employment types from the organization list, not a compiled-in one', async () => {
    const result = await listMemberFilterOptions()

    expect(result.employmentTypes).toEqual(['Full-time', 'Contract'])
    expect(prisma.lookupOption.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-1', kind: 'employmentType', archivedAt: null },
    })
  })

  it('returns the departments of this organization with their sizes', async () => {
    const result = await listMemberFilterOptions()

    expect(result).toMatchObject({
      teams: [{ id: 'team-1', name: 'Executive', memberCount: 3 }],
    })
    expect(prisma.team.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-1' },
    })
  })

  it('refuses an ordinary member', async () => {
    signedInAs({ portalRole: 'user', organizationRole: 'member' })

    expect(await codeOf(listMemberFilterOptions)).toBe(Code.PermissionDenied)
  })
})

describe('telling people their own access changed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs()
    guard.getSession.mockResolvedValue({ user: { id: 'user-9', name: 'Ada Lovelace' } })
    prisma.member.findFirst.mockResolvedValue(ROW)
  })

  it('names the new portal role to whoever now holds it', async () => {
    await applyPortalRole({ userId: 'user-1', role: 'admin' })

    expect(notifications.notifyRoleChanged).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      scope: 'portal',
      roleLabel: 'Admin',
      changedByName: 'Ada Lovelace',
    })
  })

  it('tells a suspended member, since sign-in itself will not explain why', async () => {
    await applyMemberAccess({ userId: 'user-1', banned: true })

    expect(notifications.notifyAccessChanged).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      suspended: true,
      changedByName: 'Ada Lovelace',
    })
  })
})
