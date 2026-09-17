import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  requestApprover: { findMany: vi.fn() },
  member: { findMany: vi.fn() },
  user: { findMany: vi.fn(), findUnique: vi.fn() },
}))

const email = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  portalUrl: vi.fn(),
  requestSubmittedTemplate: vi.fn(),
  requestDecidedTemplate: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/email', () => email)

const { notifyApprovers, notifyRequester } = await import('./notifications')

const SUBMITTED = {
  submissionId: 'sub-1',
  organizationId: 'org-1',
  teamId: 'team-1',
  teamName: 'Revenue Cycle',
  formName: 'Time off',
  requesterId: 'user-9',
  requesterName: 'Grace Hopper',
}

beforeEach(() => {
  vi.resetAllMocks()
  email.portalUrl.mockImplementation((route: string) => `https://portal.ihp.test/app${route}`)
  email.requestSubmittedTemplate.mockReturnValue({ subject: 'New', html: '<p/>', text: '' })
  email.requestDecidedTemplate.mockReturnValue({ subject: 'Decided', html: '<p/>', text: '' })
  prisma.user.findMany.mockImplementation(
    async ({ where }: { where: { id?: { in: string[] }; role?: string } }) =>
      where.role
        ? [{ id: 'user-portal-admin' }]
        : (where.id?.in ?? []).map((id) => ({ email: `${id}@ihp.test` })),
  )
})

describe('notifyApprovers', () => {
  it("emails each of the department's approvers separately, with a link to the request", async () => {
    prisma.requestApprover.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }])

    await notifyApprovers(SUBMITTED)

    expect(email.sendEmail.mock.calls.map((call) => call[0].to)).toEqual([
      'user-1@ihp.test',
      'user-2@ihp.test',
    ])
    expect(email.requestSubmittedTemplate).toHaveBeenCalledWith({
      requesterName: 'Grace Hopper',
      formName: 'Time off',
      teamName: 'Revenue Cycle',
      asAdmin: false,
      url: 'https://portal.ihp.test/app/requests/view/sub-1',
    })
    expect(prisma.member.findMany).not.toHaveBeenCalled()
  })

  it('falls back to organization and portal admins when the department has no approver', async () => {
    prisma.requestApprover.findMany.mockResolvedValue([])
    prisma.member.findMany.mockResolvedValue([{ userId: 'user-5' }])

    await notifyApprovers(SUBMITTED)

    expect(prisma.member.findMany.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'org-1',
      role: { in: ['owner', 'admin'] },
    })
    expect(email.sendEmail.mock.calls.map((call) => call[0].to)).toEqual([
      'user-5@ihp.test',
      'user-portal-admin@ihp.test',
    ])
    expect(email.requestSubmittedTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ asAdmin: true }),
    )
  })

  it('never asks the requester to approve their own request', async () => {
    prisma.requestApprover.findMany.mockResolvedValue([{ userId: 'user-9' }])

    await notifyApprovers(SUBMITTED)

    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(email.sendEmail).not.toHaveBeenCalled()
  })

  it('logs rather than throws when the lookup fails, since the request is already saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prisma.requestApprover.findMany.mockRejectedValue(new Error('connection reset'))

    await expect(notifyApprovers(SUBMITTED)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('notifyRequester', () => {
  it('tells the requester the decision, who made it and why', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'grace@ihp.test' })

    await notifyRequester({
      submissionId: 'sub-1',
      requesterId: 'user-9',
      formName: 'Time off',
      decision: 'rejected',
      deciderName: 'Ada Lovelace',
      note: 'Those dates overlap the audit.',
    })

    expect(email.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'grace@ihp.test' }))
    expect(email.requestDecidedTemplate).toHaveBeenCalledWith({
      formName: 'Time off',
      decision: 'rejected',
      deciderName: 'Ada Lovelace',
      note: 'Those dates overlap the audit.',
      url: 'https://portal.ihp.test/app/requests/view/sub-1',
    })
  })

  it('sends nothing for a requester whose account is gone', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    await notifyRequester({
      submissionId: 'sub-1',
      requesterId: 'user-gone',
      formName: 'Time off',
      decision: 'approved',
      deciderName: 'Ada Lovelace',
      note: undefined,
    })

    expect(email.sendEmail).not.toHaveBeenCalled()
  })
})
