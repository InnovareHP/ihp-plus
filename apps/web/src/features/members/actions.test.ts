import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  member: { count: vi.fn(), findMany: vi.fn() },
  team: { findMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({ requireOnboarded: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/auth-guard', () => guard)
vi.mock('@/lib/auth', () => ({ auth: { api: {} } }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))

const { listMemberFilterOptions, listMembers } = await import('./actions')

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
    startDate: new Date('2026-03-04T00:00:00.000Z'),
    teammembers: [{ team: { name: 'Information Technology' } }],
  },
}

function signedInAs(options: { portalRole?: string; organizationRole?: string } = {}) {
  guard.requireOnboarded.mockResolvedValue({
    user: { id: 'user-9' },
    profile: {
      role: options.portalRole ?? 'admin',
      members: [{ role: options.organizationRole ?? 'admin', organizationId: 'org-1' }],
    },
  })
}

/** The `where.user.AND` clauses the action handed Prisma. */
async function clausesFor(query: Record<string, unknown>) {
  await listMembers(query)
  const args = prisma.member.findMany.mock.calls.at(-1)?.[0]
  return { args, clauses: args?.where?.user?.AND ?? [] }
}

describe('listMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs()
    prisma.member.count.mockResolvedValue(1)
    prisma.member.findMany.mockResolvedValue([ROW])
  })

  it('refuses an ordinary member without touching the table', async () => {
    signedInAs({ portalRole: 'user', organizationRole: 'member' })

    const result = await listMembers({})

    expect(result).toEqual({
      ok: false,
      message: 'You do not have permission to manage members.',
    })
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
      ok: true,
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

describe('listMemberFilterOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs()
    prisma.team.findMany.mockResolvedValue([
      { id: 'team-1', name: 'Executive', _count: { teammembers: 3 } },
    ])
  })

  it('returns the departments of this organization with their sizes', async () => {
    const result = await listMemberFilterOptions()

    expect(result).toMatchObject({
      ok: true,
      options: { teams: [{ id: 'team-1', name: 'Executive', memberCount: 3 }] },
    })
    expect(prisma.team.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-1' },
    })
  })

  it('refuses an ordinary member', async () => {
    signedInAs({ portalRole: 'user', organizationRole: 'member' })

    expect(await listMemberFilterOptions()).toMatchObject({ ok: false })
  })
})
