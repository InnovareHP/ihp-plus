import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const service = vi.hoisted(() => ({
  DIGEST_STEPS: ['draft', 'send'] as const,
  runDigest: vi.fn(),
}))

vi.mock('@/features/security-digest/service', () => service)

const { GET } = await import('./route')

function call(query: string, token?: string) {
  return GET(
    new Request(`https://portal.test/api/cron/security-digest${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )
}

const SUMMARY = { organizations: 1, drafted: 1, issues: 0, emailed: 0 }

describe('GET /api/cron/security-digest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    service.runDigest.mockResolvedValue(SUMMARY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('runs the named step for the scheduler holding the secret', async () => {
    const response = await call('?step=draft', 'cron-secret')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(SUMMARY)
    expect(service.runDigest).toHaveBeenCalledWith('draft')
  })

  it('refuses anyone without the secret', async () => {
    expect((await call('?step=send', 'wrong')).status).toBe(401)
    expect(service.runDigest).not.toHaveBeenCalled()
  })

  it('refuses a call that does not say which step', async () => {
    expect((await call('', 'cron-secret')).status).toBe(400)
    expect((await call('?step=all', 'cron-secret')).status).toBe(400)
  })

  it('answers 500 when the run throws', async () => {
    service.runDigest.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await call('?step=send', 'cron-secret')).status).toBe(500)
  })
})
