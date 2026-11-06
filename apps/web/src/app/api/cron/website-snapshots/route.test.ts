import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const service = vi.hoisted(() => ({ sweepOldSnapshots: vi.fn(async () => 0) }))

vi.mock('@/features/websites/service', () => service)

const { GET } = await import('./route')

function call(token?: string) {
  return GET(
    new Request('https://portal.test/api/cron/website-snapshots', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )
}

describe('GET /api/cron/website-snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sweeps every organization’s old pictures for the scheduler', async () => {
    service.sweepOldSnapshots.mockResolvedValueOnce(6)

    const response = await call('cron-secret')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deleted: 6 })
    expect(service.sweepOldSnapshots).toHaveBeenCalledWith()
  })

  it('refuses anyone without the secret', async () => {
    expect((await call('wrong')).status).toBe(401)
    expect(service.sweepOldSnapshots).not.toHaveBeenCalled()
  })

  it('answers 500 when storage cannot be swept', async () => {
    service.sweepOldSnapshots.mockRejectedValueOnce(new Error('connection refused'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect((await call('cron-secret')).status).toBe(500)
  })
})
