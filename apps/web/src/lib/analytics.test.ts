import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const posthog = vi.hoisted(() => ({ capture: vi.fn() }))

vi.mock('posthog-js', () => ({ default: posthog }))

const { track } = await import('./analytics')

describe('track', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends the event and its properties to PostHog when a key is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')

    track('contracts.contract.client_accepted', { reason: null })

    expect(posthog.capture).toHaveBeenCalledWith('contracts.contract.client_accepted', {
      reason: null,
    })
  })

  it('sends nothing when no key is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '')

    track('contracts.contract.client_accepted')

    expect(posthog.capture).not.toHaveBeenCalled()
  })
})
