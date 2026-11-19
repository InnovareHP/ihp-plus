import { afterEach, describe, expect, it, vi } from 'vitest'

describe('stripe client', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('loads without a key, so the build and an unbilled portal still start', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')

    const { isStripeConfigured, stripe } = await import('./stripe')

    expect(stripe).toBeDefined()
    expect(isStripeConfigured()).toBe(false)
  })
})
