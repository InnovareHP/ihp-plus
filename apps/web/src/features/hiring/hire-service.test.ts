import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  jobApplication: { findFirst: vi.fn(), update: vi.fn() },
  applicationEvent: { create: vi.fn() },
  invitation: { findFirst: vi.fn() },
  member: { findFirst: vi.fn() },
  team: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}))
const access = vi.hoisted(() => ({ requireHiringCaller: vi.fn() }))
const auth = vi.hoisted(() => ({ api: { createInvitation: vi.fn() } }))
const pipeline = vi.hoisted(() => ({ loadApplication: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./access', () => access)
vi.mock('./pipeline-service', () => pipeline)
vi.mock('@/lib/auth', () => ({ auth }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ cookie: 'session=hr' }) }))

const { hireApplication, linkHiredApplicant } = await import('./hire-service')

const APPLICATION = {
  id: 'app-1',
  organizationId: 'org-1',
  email: 'grace@example.com',
  status: 'active',
  hiredUserId: null,
  posting: { teamId: 'team-care' },
}

async function errorOf(operation: () => Promise<unknown>) {
  return operation().then(
    () => undefined,
    (thrown: unknown) => ConnectError.from(thrown),
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
  auth.api.createInvitation.mockResolvedValue({ id: 'inv-1' })
  prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  )
  pipeline.loadApplication.mockResolvedValue({ joined: false })
})

describe('hiring', () => {
  it('invites them through Better Auth, as HR, into the posting’s department', async () => {
    await hireApplication({ applicationId: 'app-1', teamId: '' })

    const call = auth.api.createInvitation.mock.calls[0]?.[0]
    expect(call.body).toEqual({
      email: 'grace@example.com',
      role: 'member',
      organizationId: 'org-1',
      resend: true,
      teamId: 'team-care',
    })
    // The HR person's own session, so Better Auth's checks and the invite guard apply to them.
    expect(call.headers.get('cookie')).toBe('session=hr')
    expect(prisma.jobApplication.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'hired',
      invitationId: 'inv-1',
      decidedById: 'user-hr',
    })
  })

  it('shows Better Auth’s refusal and leaves the application as it was', async () => {
    auth.api.createInvitation.mockRejectedValue(new Error('HR can invite people as members only.'))

    const error = await errorOf(() => hireApplication({ applicationId: 'app-1', teamId: '' }))

    expect(error?.rawMessage).toBe('HR can invite people as members only.')
    expect(prisma.jobApplication.update).not.toHaveBeenCalled()
  })

  it('marks someone already in the organization hired without inviting them', async () => {
    prisma.member.findFirst.mockResolvedValue({ userId: 'user-9' })

    await hireApplication({ applicationId: 'app-1', teamId: '' })

    expect(auth.api.createInvitation).not.toHaveBeenCalled()
    expect(prisma.jobApplication.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'hired',
      hiredUserId: 'user-9',
    })
  })

  it('records a second hire of someone already invited as a resend', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue({ ...APPLICATION, status: 'hired' })
    prisma.invitation.findFirst.mockResolvedValue({ id: 'inv-1' })

    await hireApplication({ applicationId: 'app-1', teamId: '' })

    expect(prisma.applicationEvent.create.mock.calls[0]?.[0].data.detail).toEqual({
      invited: true,
      resent: true,
    })
  })

  it('refuses a closed application and a hire who already joined', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue({ ...APPLICATION, status: 'rejected' })
    expect(
      (await errorOf(() => hireApplication({ applicationId: 'app-1', teamId: '' })))?.code,
    ).toBe(Code.FailedPrecondition)

    prisma.jobApplication.findFirst.mockResolvedValue({
      ...APPLICATION,
      status: 'hired',
      hiredUserId: 'user-9',
    })
    expect(
      (await errorOf(() => hireApplication({ applicationId: 'app-1', teamId: '' })))?.code,
    ).toBe(Code.FailedPrecondition)
    expect(auth.api.createInvitation).not.toHaveBeenCalled()
  })

  it('refuses a department from another organization', async () => {
    prisma.team.findFirst.mockResolvedValue(null)

    expect(
      (await errorOf(() => hireApplication({ applicationId: 'app-1', teamId: 'team-elsewhere' })))
        ?.code,
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
