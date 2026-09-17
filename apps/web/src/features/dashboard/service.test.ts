import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  requestSubmission: { count: vi.fn() },
  contract: { count: vi.fn(), findMany: vi.fn() },
  stripeInvoice: { count: vi.fn() },
}))

const guards = vi.hoisted(() => ({ requestsAccess: vi.fn(), canReachApprovals: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/features/requests/guards', () => guards)

const { loadDashboardSummary } = await import('./service')

function signedInAs(options: {
  isAdmin?: boolean
  approverTeamIds?: string[]
  organizationId?: string | undefined
}) {
  const approverTeamIds = options.approverTeamIds ?? []
  guards.requestsAccess.mockResolvedValue({
    user: { id: 'user-1' },
    membership: {
      organizationId: 'organizationId' in options ? options.organizationId : 'org-1',
    },
    isAdmin: options.isAdmin ?? false,
    approverTeamIds,
  })
  guards.canReachApprovals.mockReturnValue(Boolean(options.isAdmin) || approverTeamIds.length > 0)
}

beforeEach(() => {
  vi.resetAllMocks()
  prisma.requestSubmission.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2)
  prisma.contract.count.mockResolvedValue(3)
  prisma.contract.findMany.mockResolvedValue([{ id: 'contract-1' }, { id: 'contract-2' }])
  prisma.stripeInvoice.count.mockResolvedValue(1)
})

describe('loadDashboardSummary', () => {
  it("counts an approver's queue in their departments, leaving out their own requests", async () => {
    signedInAs({ approverTeamIds: ['team-1'] })

    const summary = await loadDashboardSummary()

    expect(prisma.requestSubmission.count.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'org-1',
      status: 'pending',
      requesterId: { not: 'user-1' },
      teamId: { in: ['team-1'] },
    })
    expect(summary).toEqual({
      approvalsWaiting: 4,
      openRequests: 2,
      contractsAwaitingClient: null,
      failedPayments: null,
    })
  })

  it('shows an admin every department, contracts waiting on clients and failed payments', async () => {
    signedInAs({ isAdmin: true })

    const summary = await loadDashboardSummary()

    expect(prisma.requestSubmission.count.mock.calls[0]?.[0].where.teamId).toBeUndefined()
    expect(prisma.contract.count.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'org-1',
      status: 'sent',
      archivedAt: null,
    })
    expect(prisma.stripeInvoice.count.mock.calls[0]?.[0].where).toEqual({
      contractId: { in: ['contract-1', 'contract-2'] },
      status: 'open',
      failedAt: { not: null },
    })
    expect(summary).toEqual({
      approvalsWaiting: 4,
      openRequests: 2,
      contractsAwaitingClient: 3,
      failedPayments: 1,
    })
  })

  it('offers no approvals count to someone who decides nothing', async () => {
    prisma.requestSubmission.count.mockReset().mockResolvedValue(2)
    signedInAs({})

    const summary = await loadDashboardSummary()

    expect(prisma.requestSubmission.count).toHaveBeenCalledOnce()
    expect(summary).toMatchObject({ approvalsWaiting: null, openRequests: 2 })
  })

  it('does not look for invoices when no contract is billed', async () => {
    prisma.contract.findMany.mockResolvedValue([])
    signedInAs({ isAdmin: true })

    const summary = await loadDashboardSummary()

    expect(summary.failedPayments).toBe(0)
    expect(prisma.stripeInvoice.count).not.toHaveBeenCalled()
  })

  it('answers without querying for someone in no organization', async () => {
    signedInAs({ isAdmin: true, organizationId: undefined })

    expect(await loadDashboardSummary()).toEqual({
      approvalsWaiting: null,
      openRequests: 0,
      contractsAwaitingClient: null,
      failedPayments: null,
    })
    expect(prisma.requestSubmission.count).not.toHaveBeenCalled()
  })
})
