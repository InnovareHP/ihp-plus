import { createHmac, timingSafeEqual } from 'node:crypto'
import { portalUrl } from '@/lib/email'
import { applicationStatusRoute } from '@/lib/routes'

// Prefixed so this signature can never double as anything else signed with the same secret.
function secret() {
  const value = process.env.BETTER_AUTH_SECRET
  if (!value) throw new Error('BETTER_AUTH_SECRET is not set, so a status link cannot be signed.')
  return `application-status:${value}`
}

/** Signed over the id and the moment it was made, so nothing secret sits in the database. */
export function signStatusLink(applicationId: string, createdAt: Date) {
  return createHmac('sha256', secret())
    .update(`${applicationId}:${createdAt.getTime()}`)
    .digest('base64url')
}

export function verifyStatusLink(applicationId: string, createdAt: Date, signature: string) {
  const expected = Buffer.from(signStatusLink(applicationId, createdAt))
  const given = Buffer.from(signature)
  // Compared in constant time, so response timing cannot reveal how much of a guess was right.
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export function statusPath(applicationId: string, createdAt: Date) {
  return applicationStatusRoute(applicationId, signStatusLink(applicationId, createdAt))
}

export function statusUrl(applicationId: string, createdAt: Date) {
  return portalUrl(statusPath(applicationId, createdAt))
}
