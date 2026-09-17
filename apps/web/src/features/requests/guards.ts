import { db } from '@ihp/db'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'

// cache() dedupes the approver lookup across the layout and the page of a single request.
export const requestsAccess = cache(async () => {
  const session = await requireOnboarded()
  const membership = membershipOf(session.profile)

  const approverTeams = await db.requestApprover.findMany({
    where: { userId: session.user.id },
    select: { teamId: true },
  })

  return {
    user: session.user,
    profile: session.profile,
    membership,
    isAdmin: canManageOrganization(membership),
    approverTeamIds: approverTeams.map((row) => row.teamId),
  }
})

export type RequestsAccess = Awaited<ReturnType<typeof requestsAccess>>

export function canReachApprovals(access: Pick<RequestsAccess, 'isAdmin' | 'approverTeamIds'>) {
  return access.isAdmin || access.approverTeamIds.length > 0
}

// Not a redirect: someone with no queue should not learn that the screen exists.
export async function requireApprover() {
  const access = await requestsAccess()
  if (!canReachApprovals(access)) notFound()
  return access
}

export async function requireFormAdmin() {
  const access = await requestsAccess()
  if (!access.isAdmin) notFound()
  return access
}
