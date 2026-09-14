import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  member: { count: vi.fn(), findMany: vi.fn() },
  team: { findMany: vi.fn() },
  teamLead: { findMany: vi.fn() },
  organization: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({
  requireOnboarded: vi.fn(),
  membershipOf: vi.fn((): { organizationId: string | undefined } => ({ organizationId: 'org-1' })),
}))

const storage = vi.hoisted(() => ({
  isObjectStorageConfigured: vi.fn(() => true),
  objectUrl: vi.fn(async (key: string) => `https://files.example/${key}`),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/auth-guard', () => guard)
vi.mock('@/lib/s3', () => storage)

const { loadDepartments, loadDirectoryPage, loadOrgChart } = await import('./service')

function chartMember(id: string, name: string, jobTitle: string, onboarded = true) {
  return {
    user: {
      id,
      name,
      preferredName: null,
      jobTitle,
      onboardingCompletedAt: onboarded ? new Date('2026-03-04T00:00:00.000Z') : null,
    },
  }
}

describe('loadOrgChart', () => {
  beforeEach(() => {
    prisma.organization.findUnique
      .mockReset()
      .mockResolvedValue({ name: 'Innovare Health Partners' })
    prisma.team.findMany.mockReset().mockResolvedValue([
      {
        id: 'team-1',
        name: 'Revenue Cycle',
        teammembers: [
          chartMember('user-2', 'Grace Hopper', 'Billing Specialist'),
          chartMember('user-1', 'Ada Lovelace', 'Revenue Cycle Director'),
          chartMember('user-3', 'Mid Onboarding', '', false),
        ],
      },
    ])
    prisma.teamLead.findMany.mockReset().mockResolvedValue([{ teamId: 'team-1', userId: 'user-1' }])
    prisma.member.count.mockReset().mockResolvedValue(2)
    prisma.user.findMany.mockReset().mockResolvedValue([])
    guard.requireOnboarded.mockReset().mockResolvedValue({ profile: {} })
  })

  it('puts each department under its leads, leaving out anyone still onboarding', async () => {
    const chart = await loadOrgChart()

    expect(chart).toEqual({
      organizationName: 'Innovare Health Partners',
      unassignedCount: 2,
      departments: [
        {
          teamId: 'team-1',
          name: 'Revenue Cycle',
          leads: [{ userId: 'user-1', name: 'Ada Lovelace', jobTitle: 'Revenue Cycle Director' }],
          members: [{ userId: 'user-2', name: 'Grace Hopper', jobTitle: 'Billing Specialist' }],
        },
      ],
    })
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('still names a lead who is not a member of the department they lead', async () => {
    prisma.teamLead.findMany.mockResolvedValue([{ teamId: 'team-1', userId: 'user-9' }])
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-9', name: 'Katherine Johnson', preferredName: 'Kate', jobTitle: 'COO' },
    ])

    const chart = await loadOrgChart()

    expect(chart.departments[0]?.leads).toEqual([
      { userId: 'user-9', name: 'Kate', jobTitle: 'COO' },
    ])
    expect(chart.departments[0]?.members.map((person) => person.name)).toEqual([
      'Ada Lovelace',
      'Grace Hopper',
    ])
  })
})

const ADA = {
  user: {
    id: 'user-1',
    name: 'Ada Lovelace',
    preferredName: null,
    jobTitle: 'Software Engineer',
    email: 'ada@innovarehp.com',
    phone: '(609) 555-0134',
    ihpId: 'IHP-0001',
    employmentType: 'Full-time',
    photoKey: 'photos/ada.jpg',
    startDate: new Date('2026-03-04T00:00:00.000Z'),
    teammembers: [{ team: { name: 'Information Technology' } }],
  },
}

async function codeOf(operation: () => Promise<unknown>) {
  const error = await operation().catch((thrown: unknown) => thrown)
  return ConnectError.from(error).code
}

async function whereFor(query: Record<string, unknown>) {
  await loadDirectoryPage(query)
  return prisma.member.findMany.mock.calls.at(-1)?.[0].where
}

beforeEach(() => {
  vi.clearAllMocks()
  guard.requireOnboarded.mockResolvedValue({ user: { id: 'user-1' }, profile: {} })
  guard.membershipOf.mockReturnValue({ organizationId: 'org-1' })
  storage.isObjectStorageConfigured.mockReturnValue(true)
  prisma.member.count.mockResolvedValue(1)
  prisma.member.findMany.mockResolvedValue([ADA])
  prisma.teamLead.findMany.mockResolvedValue([])
  prisma.team.findMany.mockResolvedValue([
    { id: 'team-1', name: 'Care Management', _count: { teammembers: 4 } },
  ])
})

describe('loadDirectoryPage', () => {
  it('refuses an account with no organization before touching the table', async () => {
    guard.membershipOf.mockReturnValue({ organizationId: undefined })

    expect(await codeOf(() => loadDirectoryPage({}))).toBe(Code.FailedPrecondition)
    expect(prisma.member.findMany).not.toHaveBeenCalled()
  })

  it('lists the organization alphabetically with a stable tiebreaker', async () => {
    await loadDirectoryPage({})

    const args = prisma.member.findMany.mock.calls[0]?.[0]
    expect(args.where).toMatchObject({ organizationId: 'org-1' })
    expect(args.orderBy).toEqual([{ user: { name: 'asc' } }, { id: 'asc' }])
    expect(args).toMatchObject({ skip: 0, take: 25 })
  })

  it('leaves out anyone still mid-onboarding, who has no title or department yet', async () => {
    const where = await whereFor({})

    expect(where.user).toMatchObject({ onboardingCompletedAt: { not: null } })
  })

  it('searches the name, preferred name, title, email, phone and company id at once', async () => {
    const where = await whereFor({ search: 'ada' })

    expect(where.user.AND).toEqual([
      {
        OR: [
          { name: { contains: 'ada', mode: 'insensitive' } },
          { preferredName: { contains: 'ada', mode: 'insensitive' } },
          { jobTitle: { contains: 'ada', mode: 'insensitive' } },
          { email: { contains: 'ada', mode: 'insensitive' } },
          { phone: { contains: 'ada', mode: 'insensitive' } },
          { ihpId: { contains: 'ada', mode: 'insensitive' } },
        ],
      },
    ])
  })

  it('treats "unassigned" as having no department rather than as an id', async () => {
    const where = await whereFor({ teamIds: 'unassigned,team-1' })

    expect(where.user.AND).toEqual([
      {
        OR: [
          { teammembers: { some: { teamId: { in: ['team-1'] } } } },
          { teammembers: { none: {} } },
        ],
      },
    ])
  })

  it('lists someone by the name they are addressed by, and signs their photo link', async () => {
    prisma.member.findMany.mockResolvedValue([{ user: { ...ADA.user, preferredName: 'Addie' } }])

    const page = await loadDirectoryPage({})

    expect(page.rows[0]).toMatchObject({
      name: 'Addie',
      jobTitle: 'Software Engineer',
      department: 'Information Technology',
      ihpId: 'IHP-0001',
      photoUrl: 'https://files.example/photos/ada.jpg',
      startDate: '2026-03-04T00:00:00.000Z',
      isLead: false,
    })
  })

  it('serves a card with no photo rather than failing when storage is unset', async () => {
    storage.isObjectStorageConfigured.mockReturnValue(false)

    const page = await loadDirectoryPage({})

    expect(page.rows[0]?.photoUrl).toBe('')
    expect(storage.objectUrl).not.toHaveBeenCalled()
  })

  it('marks a department lead, in one lookup for the whole page', async () => {
    prisma.teamLead.findMany.mockResolvedValue([{ userId: 'user-1' }])

    const page = await loadDirectoryPage({})

    expect(prisma.teamLead.findMany).toHaveBeenCalledTimes(1)
    expect(page.rows[0]?.isLead).toBe(true)
  })

  it('reads a profile with nothing filled in as blanks, not nulls', async () => {
    prisma.member.findMany.mockResolvedValue([
      {
        user: {
          ...ADA.user,
          jobTitle: null,
          phone: null,
          ihpId: null,
          employmentType: null,
          photoKey: null,
          startDate: null,
          teammembers: [],
        },
      },
    ])

    expect((await loadDirectoryPage({})).rows[0]).toMatchObject({
      jobTitle: '',
      department: '',
      phone: '',
      ihpId: '',
      photoUrl: '',
      startDate: '',
    })
  })

  it('serves the last page when the requested one is past the end', async () => {
    prisma.member.count.mockResolvedValue(30)

    const page = await loadDirectoryPage({ page: 99, pageSize: 25 })

    expect(prisma.member.findMany.mock.calls.at(-1)?.[0]).toMatchObject({ skip: 25 })
    expect(page.pageInfo).toMatchObject({ page: 2, pageCount: 2, hasNext: false })
  })
})

describe('loadDepartments', () => {
  it('offers every department with its size, plus who has none', async () => {
    prisma.member.count.mockResolvedValue(2)

    const data = await loadDepartments()

    expect(data).toEqual({
      departments: [{ teamId: 'team-1', name: 'Care Management', memberCount: 4 }],
      unassignedCount: 2,
    })
  })

  it('counts only onboarded people as unassigned', async () => {
    await loadDepartments()

    expect(prisma.member.count.mock.calls[0]?.[0].where.user).toMatchObject({
      onboardingCompletedAt: { not: null },
      teammembers: { none: {} },
    })
  })
})
