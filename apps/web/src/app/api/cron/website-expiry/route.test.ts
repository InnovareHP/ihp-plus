import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const emails = vi.hoisted(() => ({
  EXPIRY_EMAIL_KINDS: ['monthly', 'alerts'] as const,
  runExpiryEmails: vi.fn(),
}))

vi.mock('@/features/websites/expiry-emails', () => emails)

const { GET } = await import('./route')

function call(query: string, token?: string) {
  return GET(
    new Request(`https://portal.test/api/cron/website-expiry${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )
}

const SUMMARY = { organizations: 1, sites: 12, emailed: 1, noLead: 0 }

describe('GET /api/cron/website-expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    emails.runExpiryEmails.mockResolvedValue(SUMMARY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('runs the named email for the scheduler holding the secret', async () => {
    const response = await call('?kind=monthly', 'cron-secret')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(SUMMARY)
    expect(emails.runExpiryEmails).toHaveBeenCalledWith('monthly')
  })

  it('refuses anyone without the secret', async () => {
    expect((await call('?kind=alerts', 'wrong')).status).toBe(401)
    expect(emails.runExpiryEmails).not.toHaveBeenCalled()
  })

  it('refuses a call that does not say which run', async () => {
    expect((await call('', 'cron-secret')).status).toBe(400)
    expect((await call('?kind=weekly', 'cron-secret')).status).toBe(400)
  })

  it('answers 500 when the run fails', async () => {
    emails.runExpiryEmails.mockRejectedValue(new Error('database down'))
    expect((await call('?kind=alerts', 'cron-secret')).status).toBe(500)
  })
})
