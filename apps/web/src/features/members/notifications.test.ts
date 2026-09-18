import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
}))

const email = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  portalUrl: vi.fn(),
  memberRoleChangedTemplate: vi.fn(),
  memberAccessChangedTemplate: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/email', () => email)

const { notifyAccessChanged, notifyRoleChanged } = await import('./notifications')

beforeEach(() => {
  vi.resetAllMocks()
  email.portalUrl.mockImplementation((route: string) => `https://portal.ihp.test/app${route}`)
  email.memberRoleChangedTemplate.mockReturnValue({ subject: 'Role', html: '<p/>', text: '' })
  email.memberAccessChangedTemplate.mockReturnValue({ subject: 'Access', html: '<p/>', text: '' })
  prisma.user.findUnique.mockResolvedValue({ email: 'grace@ihp.test' })
  prisma.organization.findUnique.mockResolvedValue({ name: 'Innovare Health Partners' })
})

describe('notifyRoleChanged', () => {
  it('tells the member which role they now hold and who set it', async () => {
    await notifyRoleChanged({
      organizationId: 'org-1',
      userId: 'user-9',
      scope: 'organization',
      roleLabel: 'Admin',
      changedByName: 'Ada Lovelace',
    })

    expect(email.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'grace@ihp.test' }))
    expect(email.memberRoleChangedTemplate).toHaveBeenCalledWith({
      organizationName: 'Innovare Health Partners',
      scope: 'organization',
      roleLabel: 'Admin',
      changedByName: 'Ada Lovelace',
      url: 'https://portal.ihp.test/app/',
    })
  })

  it('sends nothing for an account that is already gone', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    await notifyRoleChanged({
      organizationId: 'org-1',
      userId: 'user-gone',
      scope: 'portal',
      roleLabel: 'Member',
      changedByName: 'Ada Lovelace',
    })

    expect(email.sendEmail).not.toHaveBeenCalled()
  })
})

describe('notifyAccessChanged', () => {
  it('points a suspended member at the sign-in page and says who suspended them', async () => {
    await notifyAccessChanged({
      organizationId: 'org-1',
      userId: 'user-9',
      suspended: true,
      changedByName: 'Ada Lovelace',
    })

    expect(email.memberAccessChangedTemplate).toHaveBeenCalledWith({
      organizationName: 'Innovare Health Partners',
      suspended: true,
      changedByName: 'Ada Lovelace',
      url: 'https://portal.ihp.test/app/login',
    })
  })

  it('logs rather than throws, since the access change already stands', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prisma.user.findUnique.mockRejectedValue(new Error('connection reset'))

    await expect(
      notifyAccessChanged({
        organizationId: 'org-1',
        userId: 'user-9',
        suspended: false,
        changedByName: 'Ada Lovelace',
      }),
    ).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})
