import { createHmac, timingSafeEqual } from 'node:crypto'
import { clientContractRoute, withBasePath } from '@/lib/routes'

// Prefixed so a contract signature can never double as anything Better Auth signs with the same secret.
function secret() {
  const value = process.env.BETTER_AUTH_SECRET
  if (!value) throw new Error('BETTER_AUTH_SECRET is not set, so a client link cannot be signed.')
  return `contract-link:${value}`
}

/**
 * Signs the contract with the moment it was published rather than storing a token: nothing
 * secret sits in the database, and republishing or returning to draft retires every old link.
 */
export function signContractLink(contractId: string, sharedAt: Date) {
  return createHmac('sha256', secret())
    .update(`${contractId}:${sharedAt.getTime()}`)
    .digest('base64url')
}

export function verifyContractLink(contractId: string, sharedAt: Date | null, signature: string) {
  if (!sharedAt) return false
  const expected = Buffer.from(signContractLink(contractId, sharedAt))
  const given = Buffer.from(signature)
  // Compared in constant time, so response timing cannot reveal how much of a guess was right.
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** An absolute portal URL for an email, origin and basePath included. */
export function portalUrl(route: string) {
  const origin = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  return `${origin}${withBasePath(route)}`
}

export function clientContractUrl(contractId: string, sharedAt: Date) {
  return portalUrl(clientContractRoute(contractId, signContractLink(contractId, sharedAt)))
}
