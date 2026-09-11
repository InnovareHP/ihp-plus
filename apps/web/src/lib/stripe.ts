import Stripe from 'stripe'

// Next's dev server re-evaluates this module on every edit, so the client is cached the same
// way the Prisma one is.
const globalForStripe = globalThis as unknown as { ihpStripe?: Stripe }

/**
 * Pinned rather than tracking whatever the account is set to: an API version changes response
 * shapes, and that has to arrive with a deploy that was tested against it.
 */
export const STRIPE_API_VERSION = '2026-08-26.dahlia'

// No throw on a missing key: the Docker build stage has no env and must still compile, and a
// portal with no billing configured has to start.
function createClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: 'IHP Plus' },
  })
}

export const stripe = globalForStripe.ihpStripe ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForStripe.ihpStripe = stripe
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe is not configured — set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.')
    this.name = 'StripeNotConfiguredError'
  }
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
}
