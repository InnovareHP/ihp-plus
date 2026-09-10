import { db } from '@ihp/db'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from './auth'
import { routes } from './routes'

// cache() dedupes the lookup across the layout and the page of a single request.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

// Exported for RPC, which answers an unauthenticated caller with a code, not a redirect.
export const readProfile = cache(async (userId: string) =>
  db.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      middleInitial: true,
      preferredName: true,
      phone: true,
      dateOfBirth: true,
      jobTitle: true,
      employmentType: true,
      photoKey: true,
      ihpId: true,
      startDate: true,
      onboardingCompletedAt: true,
      role: true,
      // Department is team membership now, and the org role sits beside it on the same read.
      members: {
        select: {
          role: true,
          organizationId: true,
          organization: { select: { id: true, name: true, slug: true, logo: true } },
        },
        take: 1,
      },
      teammembers: { select: { team: { select: { id: true, name: true } } }, take: 1 },
    },
  }),
)

export type OnboardingProfile = NonNullable<Awaited<ReturnType<typeof readProfile>>>

export interface Membership {
  /** Portal-wide role from the admin plugin, separate from the organization role. */
  portalRole: string
  /** owner | admin | member inside the organization. */
  organizationRole: string | undefined
  organizationId: string | undefined
  organization: { id: string; name: string; slug: string; logo: string | null } | undefined
  team: { id: string; name: string } | undefined
}

export function membershipOf(profile: OnboardingProfile): Membership {
  const member = profile.members[0]
  return {
    portalRole: profile.role ?? 'user',
    organizationRole: member?.role,
    organizationId: member?.organizationId,
    organization: member?.organization,
    team: profile.teammembers[0]?.team,
  }
}

// Portal admins manage the company too, so the two role systems are collapsed in one place.
export function canManageOrganization(membership: Membership) {
  return (
    membership.portalRole === 'admin' ||
    membership.organizationRole === 'owner' ||
    membership.organizationRole === 'admin'
  )
}

// proxy.ts only sniffs the cookie, so every protected segment revalidates here.
export async function requireSession() {
  const session = await getSession()
  if (!session) redirect(routes.login)
  return session
}

// The session's cookie cache lags the row by up to five minutes, so the gate reads the flag itself.
export async function requireOnboarded() {
  const session = await requireSession()
  const profile = await readProfile(session.user.id)
  if (!profile?.onboardingCompletedAt) redirect(routes.onboarding)
  return { ...session, profile }
}

export async function requireOnboarding() {
  const session = await requireSession()
  const profile = await readProfile(session.user.id)
  // A session whose row is gone is not recoverable here; sign-in rebuilds it.
  if (!profile) redirect(routes.login)
  if (profile.onboardingCompletedAt) redirect(routes.dashboard)
  return { ...session, profile }
}

// Not a redirect: an ordinary member should not learn that the organization routes exist.
export async function requireOrganizationManager() {
  const session = await requireOnboarded()
  const membership = membershipOf(session.profile)
  if (!canManageOrganization(membership)) notFound()
  return { ...session, membership }
}
