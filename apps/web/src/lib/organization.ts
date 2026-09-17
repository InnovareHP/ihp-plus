import { db } from '@ihp/db'
import { cache } from 'react'

/**
 * The company, for a session that has no membership row yet — anyone mid-onboarding still has
 * to see its departments and its curated lists.
 *
 * `allowUserToCreateOrganization` is false, so exactly one organization is the normal state
 * and there is nothing to guess at. Two would mean picking one company's data for another
 * company's employee, so this answers undefined and the caller refuses rather than guesses.
 */
export const soleOrganizationId = cache(async () => {
  const organizations = await db.organization.findMany({ select: { id: true }, take: 2 })
  return organizations.length === 1 ? organizations[0]?.id : undefined
})
