import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  member: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
}))

const email = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  portalUrl: vi.fn(),
  memberJoinedTemplate: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/email', () => email)

const { notifyAdminsOfNewMember } = await import('./notifications')

const JOINED = {
  organizationId: 'org-1',
  userId: 'user-new',
  memberName: 'Grace Hopper',
  teamName: 'Revenue Cycle',
  jobTitle: 'Billing Specialist',
}

beforeEach(() => {
  vi.resetAllMocks()
  email.portalUrl.mockImplementation((route: string) => `https://portal.ihp.test/app${route}`)
  email.memberJoinedTemplate.mockReturnValue({ subject: 'Joined', html: '<p/>', text: '' })
  prisma.user.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.map((id) => ({ email: `${id}@ihp.test` })),
  )
})

describe('notifyAdminsOfNewMember', () => {
  it('emails every owner and admin separately, with a link to the members tab', async () => {
    prisma.member.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }])

    await notifyAdminsOfNewMember(JOINED)

    expect(prisma.member.findMany.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'org-1',
      role: { in: ['owner', 'admin'] },
    })
    expect(email.sendEmail.mock.calls.map((call) => call[0].to)).toEqual([
      'user-1@ihp.test',
      'user-2@ihp.test',
    ])
    expect(email.memberJoinedTemplate).toHaveBeenCalledWith({
      memberName: 'Grace Hopper',
      teamName: 'Revenue Cycle',
      jobTitle: 'Billing Specialist',
      url: 'https://portal.ihp.test/app/organization?tab=members',
    })
  })

  it('never announces an admin to themselves', async () => {
    prisma.member.findMany.mockResolvedValue([{ userId: 'user-new' }])

    await notifyAdminsOfNewMember(JOINED)

    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(email.sendEmail).not.toHaveBeenCalled()
  })

  it('logs rather than throws, since the profile is already saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prisma.member.findMany.mockRejectedValue(new Error('connection reset'))

    await expect(notifyAdminsOfNewMember(JOINED)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})
