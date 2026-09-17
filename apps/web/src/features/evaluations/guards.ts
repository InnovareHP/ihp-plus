import { notFound } from 'next/navigation'
import { cache } from 'react'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'

// cache() dedupes the membership read across the layout and the page of a single request.
export const evaluationsAccess = cache(async () => {
  const session = await requireOnboarded()
  const membership = membershipOf(session.profile)

  return {
    user: session.user,
    profile: session.profile,
    membership,
    isAdmin: canManageOrganization(membership),
  }
})

export type EvaluationsAccess = Awaited<ReturnType<typeof evaluationsAccess>>

// Not a redirect: someone who cannot assign evaluations should not learn the screen exists.
export async function requireEvaluationAdmin() {
  const access = await evaluationsAccess()
  if (!access.isAdmin) notFound()
  return access
}
