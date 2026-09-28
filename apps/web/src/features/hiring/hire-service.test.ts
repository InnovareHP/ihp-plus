import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  jobApplication: { findFirst: vi.fn(), update: vi.fn() },
  applicationEvent: { create: vi.fn() },
  invitation: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  member: { findFirst: vi.fn() },
  team: { findFirst: vi.fn() },
  organization: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}))
const access = vi.hoisted(() => ({ requireHiringCaller: vi.fn() }))
const email = vi.hoisted(() => ({ sendEmail: vi.fn() }))
const pipeline = vi.hoisted(() => ({ loadApplication: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./access', () => access)
vi.mock('./pipeline-service', () => pipeline)
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: email.sendEmail,
}))

const { hireApplication, linkHiredApplicant } = await import('./hire-service')

const APPLICATION = {
  id: 'app-1',
  organizationId: 'org-1',
  email: 'grace@example.com',
  status: 'active',
  hiredUserId: null,
  posting: { teamId: 'team-care' },
}

async function codeOf(operation: () => Promise<unknown>) {
  return operation().then(
    () => undefined,
    (thrown: unknown) => ConnectError.from(thrown).code,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  access.requireHiringCaller.mockResolvedValue({
    userId: 'user-hr',
    name: 'Rita',
    organizationId: 'org-1',
    isAdmin: false,
  })
  prisma.jobApplication.findFirst.mockResolvedValue(APPLICATION)
  prisma.team.findFirst.mockResolvedValue({ id: 'team-care' })
  prisma.member.findFirst.mockResolvedValue(null)
  prisma.invitation.findFirst.mockResolvedValue(null)
  prisma.invitation.create.mockImplementation(async ({ data }) => data)
  prisma.invitation.update.mockImplementation(async ({ where, data }) => ({
    id: where.id,
    ...data,
  }))
  prisma.organization.findUnique.mockResolvedValue({ name: 'IHP+' })
  prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  )
  pipeline.loadApplication.mockResolvedValue({ joined: false })
})

describe('hiring', () => {
  it('invites them as a member of the posting’s department and emails the link', async () => {
    await hireApplication({ applicationId: 'app-1', teamId: '' })

    const invitation = prisma.invitation.create.mock.calls[0]?.[0].data
    expect(invitation).toMatchObject({
      organizationId: 'org-1',
      email: 'grace@example.com',
      role: 'member',
      teamId: 'team-care',
      status: 'pending',
      inviterId: 'user-hr',
    })
    expect(invitation.expiresAt.getTime() - Date.now()).toBeGreaterThan(47 * 60 * 60 * 1000)
    expect(prisma.jobApplication.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'hired',
      invitationId: invitation.id,
      decidedById: 'user-hr',
    })
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'grace@example.com',
        text: expect.stringContaining(`/accept-invitation/${invitation.id}`),
      }),
    )
  })

  it('marks someone already in the organization hired without inviting them', async () => {
    prisma.member.findFirst.mockResolvedValue({ userId: 'user-9' })

    await hireApplication({ applicationId: 'app-1', teamId: '' })

    expect(prisma.invitation.create).not.toHaveBeenCalled()
    expect(email.sendEmail).not.toHaveBeenCalled()
    expect(prisma.jobApplication.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'hired',
      hiredUserId: 'user-9',
    })
  })

  it('sends the same invitation again rather than a second one', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue({ ...APPLICATION, status: 'hired' })
    prisma.invitation.findFirst.mockResolvedValue({ id: 'inv-1' })

    await hireApplication({ applicationId: 'app-1', teamId: '' })

    expect(prisma.invitation.create).not.toHaveBeenCalled()
    expect(prisma.invitation.update.mock.calls[0]?.[0].where).toEqual({ id: 'inv-1' })
    expect(prisma.applicationEvent.create.mock.calls[0]?.[0].data.detail).toEqual({
      invited: true,
      resent: true,
    })
  })

  it('refuses a closed application and a hire who already joined', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue({ ...APPLICATION, status: 'rejected' })
    expect(await codeOf(() => hireApplication({ applicationId: 'app-1', teamId: '' }))).toBe(
      Code.FailedPrecondition,
    )

    prisma.jobApplication.findFirst.mockResolvedValue({
      ...APPLICATION,
      status: 'hired',
      hiredUserId: 'user-9',
    })
    expect(await codeOf(() => hireApplication({ applicationId: 'app-1', teamId: '' }))).toBe(
      Code.FailedPrecondition,
    )
    expect(prisma.invitation.create).not.toHaveBeenCalled()
  })

  it('refuses a department from another organization', async () => {
    prisma.team.findFirst.mockResolvedValue(null)

    expect(
      await codeOf(() => hireApplication({ applicationId: 'app-1', teamId: 'team-elsewhere' })),
    ).toBe(Code.NotFound)
  })
})

describe('linking the account back', () => {
  it('ties the new account to the application its invitation came from', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue({ id: 'app-1' })

    await linkHiredApplicant('inv-1', 'user-new')

    expect(prisma.jobApplication.findFirst.mock.calls[0]?.[0].where).toEqual({
      invitationId: 'inv-1',
      status: 'hired',
      hiredUserId: null,
    })
    expect(prisma.jobApplication.update).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: { hiredUserId: 'user-new' },
    })
    expect(prisma.applicationEvent.create.mock.calls[0]?.[0].data.kind).toBe('joined')
  })

  it('does nothing for an invitation that did not come from hiring', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue(null)

    await linkHiredApplicant('inv-2', 'user-new')

    expect(prisma.jobApplication.update).not.toHaveBeenCalled()
  })
})
