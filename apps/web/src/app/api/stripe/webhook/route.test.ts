import { beforeEach, describe, expect, it, vi } from 'vitest'

const billing = vi.hoisted(() => ({
  claimEvent: vi.fn(),
  handleEvent: vi.fn(),
  markProcessed: vi.fn(),
  markFailed: vi.fn(),
}))

const stripeLib = vi.hoisted(() => ({
  constructEventAsync: vi.fn(),
  isStripeConfigured: vi.fn(() => true),
}))

vi.mock('@/features/billing/service', () => billing)
vi.mock('@/lib/stripe', () => ({
  stripe: { webhooks: { constructEventAsync: stripeLib.constructEventAsync } },
  isStripeConfigured: stripeLib.isStripeConfigured,
}))

const { POST } = await import('./route')

const EVENT = { id: 'evt_1', type: 'invoice.paid', data: { object: {} } }

function post({ signature = 't=1,v1=abc', body = '{"id":"evt_1"}' } = {}) {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: signature ? { 'stripe-signature': signature } : {},
    body,
  })
}

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stripeLib.isStripeConfigured.mockReturnValue(true)
    stripeLib.constructEventAsync.mockResolvedValue(EVENT)
    billing.claimEvent.mockResolvedValue({ alreadyProcessed: false })
    billing.handleEvent.mockResolvedValue('handled')
  })

  it('verifies the signature against the raw body, not a parsed one', async () => {
    const body = '{"id":"evt_1","type":"invoice.paid"}'

    await POST(post({ body }))

    const [sent, signature, secret] = stripeLib.constructEventAsync.mock.calls[0] ?? []
    expect(sent).toBe(body)
    expect(signature).toBe('t=1,v1=abc')
    expect(typeof secret).toBe('string')
  })

  it('rejects an unsigned request without reaching the handler', async () => {
    const response = await POST(post({ signature: '' }))

    expect(response.status).toBe(400)
    expect(stripeLib.constructEventAsync).not.toHaveBeenCalled()
    expect(billing.handleEvent).not.toHaveBeenCalled()
  })

  it('answers 400 on a bad signature, so Stripe does not retry a forgery for days', async () => {
    stripeLib.constructEventAsync.mockRejectedValue(new Error('No signatures found'))

    const response = await POST(post())

    expect(response.status).toBe(400)
    expect(billing.claimEvent).not.toHaveBeenCalled()
    expect(billing.handleEvent).not.toHaveBeenCalled()
  })

  it('handles a fresh event and marks it processed', async () => {
    const response = await POST(post())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true, status: 'handled' })
    expect(billing.handleEvent).toHaveBeenCalledWith(EVENT)
    expect(billing.markProcessed).toHaveBeenCalledWith('evt_1')
  })

  it('does the work once when Stripe delivers the same event twice', async () => {
    billing.claimEvent.mockResolvedValue({ alreadyProcessed: true })

    const response = await POST(post())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true, status: 'duplicate' })
    expect(billing.handleEvent).not.toHaveBeenCalled()
  })

  it('acknowledges an event it does not handle rather than making Stripe retry it', async () => {
    billing.handleEvent.mockResolvedValue('ignored')

    const response = await POST(post())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true, status: 'ignored' })
    expect(billing.markProcessed).toHaveBeenCalledWith('evt_1')
  })

  it('answers 500 and records the failure when the handler throws, so Stripe retries', async () => {
    billing.handleEvent.mockRejectedValue(new Error('database is down'))

    const response = await POST(post())

    expect(response.status).toBe(500)
    expect(billing.markFailed).toHaveBeenCalledWith('evt_1', expect.any(Error))
    expect(billing.markProcessed).not.toHaveBeenCalled()
  })

  it('keeps retrying rather than dropping events when Stripe is not configured', async () => {
    stripeLib.isStripeConfigured.mockReturnValue(false)

    const response = await POST(post())

    expect(response.status).toBe(500)
    expect(stripeLib.constructEventAsync).not.toHaveBeenCalled()
  })
})
