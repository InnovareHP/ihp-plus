import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const job = vi.hoisted(() => ({ postCelebrations: vi.fn() }))

vi.mock('@/features/bulletin/celebrations', () => job)

const { GET } = await import('./route')

function call(token?: string) {
  return GET(
    new Request('https://portal.test/api/cron/celebrations', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )
}

describe('GET /api/cron/celebrations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    job.postCelebrations.mockResolvedValue(18)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('posts the day’s celebrations for the scheduler holding the secret', async () => {
    const response = await call('cron-secret')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ posted: 18 })
  })

  it('refuses anyone without the secret', async () => {
    expect((await call('wrong')).status).toBe(401)
    expect((await call()).status).toBe(401)
    expect(job.postCelebrations).not.toHaveBeenCalled()
  })

  it('answers 500 when a run fails, so the scheduler logs it', async () => {
    job.postCelebrations.mockRejectedValue(new Error('database down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await call('cron-secret')).status).toBe(500)
  })
})
