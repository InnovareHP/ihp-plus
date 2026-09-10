import { db } from '@ihp/db'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from './auth'
import { routes } from './routes'

// cache() dedupes the lookup across the layout and the page of a single request.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

const readProfile = cache(async (userId: string) =>
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
      members: { select: { role: true, organizationId: true }, take: 1 },
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
  team: { id: string; name: string } | undefined
}

export function membershipOf(profile: OnboardingProfile): Membership {
  return {
    portalRole: profile.role ?? 'user',
    organizationRole: profile.members[0]?.role,
    organizationId: profile.members[0]?.organizationId,
    team: profile.teammembers[0]?.team,
  }
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
