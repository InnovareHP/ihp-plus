import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const subscription = vi.hoisted(() => ({ renewDriveSubscriptions: vi.fn() }))

vi.mock('@/features/drive/subscription', () => subscription)

const { GET } = await import('./route')

function call(token?: string) {
  return GET(
    new Request('https://portal.test/api/graph/renew', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )
}

describe('GET /api/graph/renew', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    subscription.renewDriveSubscriptions.mockResolvedValue({ renewed: ['drive-1'], failed: [] })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renews for the scheduler holding the cron secret', async () => {
    const response = await call('cron-secret')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ renewed: ['drive-1'], failed: [] })
  })

  it('refuses anyone without the secret, or any caller when none is set', async () => {
    expect((await call('wrong')).status).toBe(401)
    expect((await call()).status).toBe(401)

    vi.stubEnv('CRON_SECRET', '')
    expect((await call('')).status).toBe(401)
    expect(subscription.renewDriveSubscriptions).not.toHaveBeenCalled()
  })

  it('answers 207 when some drives failed to renew', async () => {
    subscription.renewDriveSubscriptions.mockResolvedValue({
      renewed: [],
      failed: [{ driveId: 'drive-1', message: 'boom' }],
    })

    expect((await call('cron-secret')).status).toBe(207)
  })

  it('answers 500 when the run throws, so the scheduler logs it', async () => {
    subscription.renewDriveSubscriptions.mockRejectedValue(new Error('database down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await call('cron-secret')).status).toBe(500)
  })
})
