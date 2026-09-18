import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }))

const email = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  portalUrl: vi.fn(),
  clientOwnerAssignedTemplate: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/email', () => email)

const { notifyOwnerAssigned } = await import('./notifications')

const ASSIGNMENT = {
  clientName: 'Riverside Care Center',
  ownerId: 'user-owner',
  assignedById: 'user-admin',
  assignedByName: 'Ada Lovelace',
}

beforeEach(() => {
  vi.resetAllMocks()
  email.portalUrl.mockImplementation((route: string) => `https://portal.ihp.test/app${route}`)
  email.clientOwnerAssignedTemplate.mockReturnValue({ subject: 'Yours', html: '<p/>', text: '' })
  prisma.user.findUnique.mockResolvedValue({ email: 'owner@ihp.test' })
})

describe('notifyOwnerAssigned', () => {
  it('tells the new owner which client came to them and who handed it over', async () => {
    await notifyOwnerAssigned(ASSIGNMENT)

    expect(email.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@ihp.test' }))
    expect(email.clientOwnerAssignedTemplate).toHaveBeenCalledWith({
      clientName: 'Riverside Care Center',
      assignedByName: 'Ada Lovelace',
      url: 'https://portal.ihp.test/app/clients',
    })
  })

  it('stays quiet when somebody takes a client themselves', async () => {
    await notifyOwnerAssigned({ ...ASSIGNMENT, assignedById: 'user-owner' })

    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(email.sendEmail).not.toHaveBeenCalled()
  })

  it('logs rather than throws, since the client is already saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prisma.user.findUnique.mockRejectedValue(new Error('connection reset'))

    await expect(notifyOwnerAssigned(ASSIGNMENT)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})
