import { db } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import {
  canManageOrganization,
  getSession,
  membershipOf,
  readProfile,
  requireOnboarded,
  type Membership,
} from '@/lib/auth-guard'

/** The department whose members run hiring beside the admins; none set means admins only. */
export async function hrTeamIdOf(organizationId: string) {
  const settings = await db.hiringSettings.findUnique({
    where: { organizationId },
    select: { hrTeamId: true },
  })
  return settings?.hrTeamId ?? undefined
}

export function canManageHiringWith(membership: Membership, hrTeamId: string | undefined) {
  if (canManageOrganization(membership)) return true
  return Boolean(hrTeamId && membership.team?.id === hrTeamId)
}

export async function canManageHiring(membership: Membership) {
  if (canManageOrganization(membership)) return true
  if (!membership.organizationId || !membership.team) return false
  return canManageHiringWith(membership, await hrTeamIdOf(membership.organizationId))
}

// cache() dedupes the read across the layout and the page of a single request.
export const hiringAccess = cache(async () => {
  const session = await requireOnboarded()
  const membership = membershipOf(session.profile)
  return {
    user: session.user,
    membership,
    isAdmin: canManageOrganization(membership),
    canManage: await canManageHiring(membership),
  }
})

// Not a redirect: someone outside HR should not learn the screen exists.
export async function requireHiringPage() {
  const access = await hiringAccess()
  if (!access.canManage) notFound()
  return access
}

// Deliberately not requireOnboarded(): that redirects, and a redirect thrown inside an RPC
// surfaces as an opaque 500 rather than a code the caller can act on.
export async function requireHiringCaller() {
  const session = await getSession()
  if (!session) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const profile = await readProfile(session.user.id)
  if (!profile) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const membership = membershipOf(profile)
  if (!membership.organizationId) {
    throw new ConnectError('Finish setting up your profile first.', Code.FailedPrecondition)
  }
  if (!(await canManageHiring(membership))) {
    throw new ConnectError('Only HR and admins can manage hiring.', Code.PermissionDenied)
  }

  return {
    userId: session.user.id,
    name: profile.preferredName ?? session.user.name,
    organizationId: membership.organizationId,
    isAdmin: canManageOrganization(membership),
  }
}

export type HiringCaller = Awaited<ReturnType<typeof requireHiringCaller>>
