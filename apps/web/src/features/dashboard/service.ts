import { db } from '@ihp/db'
import { canReachApprovals, requestsAccess } from '@/features/requests/guards'

export interface DashboardSummary {
  /** Null when the caller decides no requests, so the card is not offered at all. */
  approvalsWaiting: number | null
  openRequests: number
  /** Null for anyone who cannot manage contracts. */
  contractsAwaitingClient: number | null
  failedPayments: number | null
}

/** What is waiting on the signed-in person, read once per dashboard render. */
export async function loadDashboardSummary(): Promise<DashboardSummary> {
  const access = await requestsAccess()
  const organizationId = access.membership.organizationId
  const userId = access.user.id

  if (!organizationId) {
    return {
      approvalsWaiting: null,
      openRequests: 0,
      contractsAwaitingClient: null,
      failedPayments: null,
    }
  }

  const [approvalsWaiting, openRequests, contractsAwaitingClient, failedPayments] =
    await Promise.all([
      canReachApprovals(access)
        ? db.requestSubmission.count({
            where: {
              organizationId,
              status: 'pending',
              // Nobody decides their own request, so it is not waiting on them.
              requesterId: { not: userId },
              ...(access.isAdmin ? {} : { teamId: { in: access.approverTeamIds } }),
            },
          })
        : null,
      db.requestSubmission.count({
        where: { organizationId, requesterId: userId, status: 'pending' },
      }),
      access.isAdmin
        ? db.contract.count({ where: { organizationId, status: 'sent', archivedAt: null } })
        : null,
      access.isAdmin ? failedPaymentCount(organizationId) : null,
    ])

  return { approvalsWaiting, openRequests, contractsAwaitingClient, failedPayments }
}

// An invoice row carries no organization, so it is counted through the contracts that do.
async function failedPaymentCount(organizationId: string) {
  const billed = await db.contract.findMany({
    where: { organizationId, stripeCustomerId: { not: null } },
    select: { id: true },
  })
  if (billed.length === 0) return 0

  return db.stripeInvoice.count({
    where: {
      contractId: { in: billed.map((contract) => contract.id) },
      status: 'open',
      failedAt: { not: null },
    },
  })
}
