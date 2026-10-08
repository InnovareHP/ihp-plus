import { db } from '@ihp/db'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { isTeamLead } from '@/features/teams/leads'
import {
  canManageOrganization,
  membershipOf,
  requireOnboarded,
  type Membership,
} from '@/lib/auth-guard'

/** The department that sees the websites page; none set means admins only, until one picks it. */
export async function itTeamIdOf(organizationId: string) {
  const settings = await db.websiteSettings.findUnique({
    where: { organizationId },
    select: { itTeamId: true },
  })
  return settings?.itTeamId ?? undefined
}

export interface WebsitesRole {
  canView: boolean
  /** Only the IT lead runs the time-in and time-out checks. */
  canCheck: boolean
  canManage: boolean
  /** Picking the IT department decides who sees the page, which is an admin's call. */
  canConfigure: boolean
  itTeamId: string | undefined
}

export function websitesRoleOf(
  membership: Membership,
  itTeamId: string | undefined,
  leadsIt: boolean,
): WebsitesRole {
  const isAdmin = canManageOrganization(membership)
  const inIt = Boolean(itTeamId && membership.team?.id === itTeamId)
  return {
    canView: isAdmin || inIt || leadsIt,
    canCheck: leadsIt,
    canManage: isAdmin || leadsIt,
    canConfigure: isAdmin,
    itTeamId,
  }
}

export async function websitesRole(membership: Membership, userId: string) {
  const organizationId = membership.organizationId
  if (!organizationId) return websitesRoleOf(membership, undefined, false)

  const itTeamId = await itTeamIdOf(organizationId)
  const leadsIt = itTeamId ? await isTeamLead(organizationId, userId, itTeamId) : false
  return websitesRoleOf(membership, itTeamId, leadsIt)
}

// cache() dedupes the read across the layout, the page and the actions of a single request.
export const websitesAccess = cache(async () => {
  const { user, profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  return {
    userId: user.id,
    userName: profile.preferredName ?? user.name,
    organizationId: membership.organizationId,
    ...(await websitesRole(membership, user.id)),
  }
})

export type WebsitesCaller = Awaited<ReturnType<typeof websitesAccess>>

// Not a redirect: someone outside IT should not learn the screen exists.
export async function requireWebsitesPage() {
  const access = await websitesAccess()
  if (!access.canView) notFound()
  return access
}
