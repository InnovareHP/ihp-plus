import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  team: { findMany: vi.fn(), findFirst: vi.fn() },
  member: { findMany: vi.fn(), findFirst: vi.fn() },
  teamLead: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({
  requireOnboarded: vi.fn(),
  membershipOf: vi.fn((): { organizationId: string | undefined } => ({ organizationId: 'org-1' })),
  canManageOrganization: vi.fn(() => true),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/auth-guard', () => guard)

const { addDepartmentLead, listDepartmentLeads, removeDepartmentLead } = await import('./actions')

function signedIn({ isAdmin = true }: { isAdmin?: boolean } = {}) {
  guard.requireOnboarded.mockResolvedValue({ user: { id: 'user-1' }, profile: {} })
  guard.membershipOf.mockReturnValue({ organizationId: 'org-1' })
  guard.canManageOrganization.mockReturnValue(isAdmin)
}

beforeEach(() => {
  vi.clearAllMocks()
  signedIn()
  prisma.team.findMany.mockResolvedValue([{ id: 'team-1', name: 'Revenue Cycle' }])
  prisma.team.findFirst.mockResolvedValue({ id: 'team-1' })
  prisma.member.findMany.mockResolvedValue([
    { user: { id: 'user-2', name: 'Grace Hopper', email: 'grace@innovarehp.com' } },
  ])
  prisma.member.findFirst.mockResolvedValue({ id: 'member-2' })
  prisma.teamLead.findMany.mockResolvedValue([{ id: 'lead-1', teamId: 'team-1', userId: 'user-2' }])
  prisma.teamLead.createMany.mockResolvedValue({ count: 1 })
  prisma.teamLead.deleteMany.mockResolvedValue({ count: 1 })
})

describe('listDepartmentLeads', () => {
  it('reads open to everyone: who leads what is ordinary company information', async () => {
    signedIn({ isAdmin: false })

    expect(await listDepartmentLeads()).toMatchObject({
      ok: true,
      data: {
        teams: [{ id: 'team-1', name: 'Revenue Cycle' }],
        members: [{ id: 'user-2', name: 'Grace Hopper' }],
        leads: [{ teamId: 'team-1', userId: 'user-2' }],
      },
    })
  })
})

describe('addDepartmentLead', () => {
  it('is closed to anyone who cannot manage the organization', async () => {
    signedIn({ isAdmin: false })

    expect(await addDepartmentLead({ teamId: 'team-1', userId: 'user-2' })).toEqual({
      ok: false,
      message: 'Only an admin can change who leads a department.',
    })
    expect(prisma.teamLead.createMany).not.toHaveBeenCalled()
  })

  it('names a lead, skipping a duplicate rather than failing', async () => {
    expect(await addDepartmentLead({ teamId: 'team-1', userId: 'user-2' })).toEqual({ ok: true })
    expect(prisma.teamLead.createMany.mock.calls[0]?.[0]).toMatchObject({
      data: [{ organizationId: 'org-1', teamId: 'team-1', userId: 'user-2' }],
      skipDuplicates: true,
    })
  })

  it('refuses a department from another organization', async () => {
    prisma.team.findFirst.mockResolvedValue(null)

    expect(await addDepartmentLead({ teamId: 'team-x', userId: 'user-2' })).toEqual({
      ok: false,
      message: 'That department no longer exists.',
    })
    expect(prisma.teamLead.createMany).not.toHaveBeenCalled()
  })

  it('refuses someone who is not a member here', async () => {
    prisma.member.findFirst.mockResolvedValue(null)

    expect(await addDepartmentLead({ teamId: 'team-1', userId: 'outsider' })).toEqual({
      ok: false,
      message: 'That person is not in this organization.',
    })
    expect(prisma.teamLead.createMany).not.toHaveBeenCalled()
  })
})

describe('removeDepartmentLead', () => {
  it('is closed to a non-admin', async () => {
    signedIn({ isAdmin: false })

    expect(await removeDepartmentLead({ teamId: 'team-1', userId: 'user-2' })).toMatchObject({
      ok: false,
    })
    expect(prisma.teamLead.deleteMany).not.toHaveBeenCalled()
  })

  it('removes the row inside this organization', async () => {
    expect(await removeDepartmentLead({ teamId: 'team-1', userId: 'user-2' })).toEqual({ ok: true })
    expect(prisma.teamLead.deleteMany.mock.calls[0]?.[0]).toEqual({
      where: { organizationId: 'org-1', teamId: 'team-1', userId: 'user-2' },
    })
  })

  it('says so when they did not lead it', async () => {
    prisma.teamLead.deleteMany.mockResolvedValue({ count: 0 })

    expect(await removeDepartmentLead({ teamId: 'team-1', userId: 'user-2' })).toEqual({
      ok: false,
      message: 'They do not lead that department.',
    })
  })
})
