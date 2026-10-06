import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  member: { findMany: vi.fn() },
  hiringSettings: { findUnique: vi.fn() },
  teamMember: { findMany: vi.fn() },
}))
const email = vi.hoisted(() => ({ sendEmail: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: email.sendEmail,
}))

const { hiringAdminEmails, notifyApplicationReceived } = await import('./notifications')

const APPLICATION = {
  applicationId: 'app-1',
  organizationId: 'org-1',
  organizationName: 'IHP+',
  fullName: 'Grace Hopper',
  email: 'grace@example.com',
  postingTitle: 'Registered nurse',
  statusUrl: 'https://ihp.test/app/careers/status/app-1/sig',
}

beforeEach(() => {
  vi.clearAllMocks()
  prisma.hiringSettings.findUnique.mockResolvedValue({ hrTeamId: 'team-hr' })
  prisma.teamMember.findMany.mockResolvedValue([{ user: { email: 'hr@ihp.test', banned: false } }])
  prisma.member.findMany.mockResolvedValue([
    { user: { email: 'owner@ihp.test', banned: false } },
    { user: { email: 'admin@ihp.test', banned: false } },
    { user: { email: 'gone@ihp.test', banned: true } },
  ])
})

describe('hiringAdminEmails', () => {
  it('returns the unbanned owners and admins, even when an HR department is set', async () => {
    expect(await hiringAdminEmails('org-1')).toEqual(['owner@ihp.test', 'admin@ihp.test'])
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', role: { in: ['owner', 'admin'] } },
      }),
    )
    expect(prisma.teamMember.findMany).not.toHaveBeenCalled()
  })
})

describe('notifyApplicationReceived', () => {
  it('emails the applicant and every admin, not the HR department', async () => {
    await notifyApplicationReceived(APPLICATION)

    const recipients = email.sendEmail.mock.calls.map(([message]) => message.to)
    expect(recipients).toEqual(['grace@example.com', 'owner@ihp.test', 'admin@ihp.test'])
  })
})
