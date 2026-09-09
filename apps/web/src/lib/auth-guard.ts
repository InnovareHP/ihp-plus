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
      department: true,
      employmentType: true,
      photoKey: true,
      ihpId: true,
      startDate: true,
      onboardingCompletedAt: true,
    },
  }),
)

export type OnboardingProfile = NonNullable<Awaited<ReturnType<typeof readProfile>>>

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
