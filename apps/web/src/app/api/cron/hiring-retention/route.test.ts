import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const job = vi.hoisted(() => ({ sweepHiringData: vi.fn() }))

vi.mock('@/features/hiring/retention', () => job)

const { GET } = await import('./route')

function call(token?: string) {
  return GET(
    new Request('https://portal.test/api/cron/hiring-retention', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )
}

describe('GET /api/cron/hiring-retention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    job.sweepHiringData.mockResolvedValue({ applications: 3, strayFiles: 2 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('clears old hiring data for the scheduler holding the secret', async () => {
    const response = await call('cron-secret')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ applications: 3, strayFiles: 2 })
  })

  it('refuses anyone without the secret', async () => {
    expect((await call('wrong')).status).toBe(401)
    expect((await call()).status).toBe(401)
    expect(job.sweepHiringData).not.toHaveBeenCalled()
  })

  it('answers 500 when a run fails, so the scheduler logs it', async () => {
    job.sweepHiringData.mockRejectedValue(new Error('database down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await call('cron-secret')).status).toBe(500)
  })
})
