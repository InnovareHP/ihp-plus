import { beforeEach, describe, expect, it, vi } from 'vitest'

const email = vi.hoisted(() => ({ sendEmail: vi.fn() }))
const limiter = vi.hoisted(() => ({ consumeRateLimit: vi.fn() }))
const fetchMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/email', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/email')>()),
  ...email,
}))
vi.mock('@/lib/rate-limit', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/rate-limit')>()),
  ...limiter,
}))

const { OPTIONS, POST } = await import('./route')

const ENQUIRY = {
  name: 'Grace Hopper',
  email: 'grace@example.com',
  phone: '+63 912 345 6789',
  message: 'We need help with billing.',
  'cf-turnstile-response': 'token-1',
}

function post(body: unknown) {
  return POST(
    new Request('http://ihp.test/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4, 10.0.0.1' },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-1')
  vi.stubEnv('CONTACT_INBOX', 'sales@ihp.test')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue(Response.json({ success: true }))
  limiter.consumeRateLimit.mockResolvedValue({ allowed: true, retryAfter: null })
  email.sendEmail.mockResolvedValue({ delivered: true })
})

describe('POST /api/contact', () => {
  it('verifies the Turnstile token and emails the enquiry to the sales inbox', async () => {
    const response = await post(ENQUIRY)

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    const verify = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(Object.fromEntries(verify.body as URLSearchParams)).toEqual({
      secret: 'secret-1',
      response: 'token-1',
      remoteip: '1.2.3.4',
    })
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sales@ihp.test',
        subject: 'Website enquiry from Grace Hopper',
        text: expect.stringContaining('grace@example.com'),
      }),
    )
  })

  it('rejects a malformed enquiry before spending a rate-limit slot', async () => {
    const response = await post({ ...ENQUIRY, email: 'grace@' })

    expect(response.status).toBe(400)
    expect(limiter.consumeRateLimit).not.toHaveBeenCalled()
    expect(email.sendEmail).not.toHaveBeenCalled()
  })

  it('refuses a name with a line break, since it becomes the subject', async () => {
    expect((await post({ ...ENQUIRY, name: 'Grace\nBcc: x@y.z' })).status).toBe(400)
  })

  it('throttles a connection that has sent too many', async () => {
    limiter.consumeRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 })

    expect((await post(ENQUIRY)).status).toBe(429)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a failed or missing Turnstile check', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: false }))
    expect((await post(ENQUIRY)).status).toBe(403)

    expect((await post({ ...ENQUIRY, 'cf-turnstile-response': '' })).status).toBe(403)
    expect(email.sendEmail).not.toHaveBeenCalled()
  })

  it('treats an unreachable Turnstile as a failed check', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    expect((await post(ENQUIRY)).status).toBe(403)
  })

  it('skips Turnstile when no secret is configured, so local dev works without Cloudflare', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')

    expect((await post({ ...ENQUIRY, 'cf-turnstile-response': '' })).status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a failure when the email was not delivered, so the visitor can retry', async () => {
    email.sendEmail.mockResolvedValue({ delivered: false, reason: 'send-failed' })

    expect((await post(ENQUIRY)).status).toBe(502)
  })

  it('reports a failure when no inbox is configured', async () => {
    vi.stubEnv('CONTACT_INBOX', '')

    expect((await post(ENQUIRY)).status).toBe(502)
    expect(email.sendEmail).not.toHaveBeenCalled()
  })
})

describe('OPTIONS /api/contact', () => {
  it('answers the cross-origin preflight from the marketing site', () => {
    const response = OPTIONS()

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-headers')).toBe('content-type')
  })
})
