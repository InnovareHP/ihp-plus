import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const weekend = vi.hoisted(() => ({ runWeekendChecks: vi.fn() }))

vi.mock('@/features/websites/weekend', () => weekend)

const { GET } = await import('./route')

function call(query: string, token?: string) {
  return GET(
    new Request(`https://portal.test/api/cron/website-checks${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )
}

const SUMMARY = { organizations: 1, checked: 4, problems: 1, emailed: 2 }

describe('GET /api/cron/website-checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    weekend.runWeekendChecks.mockResolvedValue(SUMMARY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('runs the named round for the scheduler holding the secret', async () => {
    const response = await call('?round=clock_out', 'cron-secret')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(SUMMARY)
    expect(weekend.runWeekendChecks).toHaveBeenCalledWith('clock_out')
  })

  it('refuses anyone without the secret', async () => {
    expect((await call('?round=clock_in', 'wrong')).status).toBe(401)
    expect(weekend.runWeekendChecks).not.toHaveBeenCalled()
  })

  it('refuses a call that does not say which round', async () => {
    expect((await call('', 'cron-secret')).status).toBe(400)
    expect((await call('?round=lunch', 'cron-secret')).status).toBe(400)
  })

  it('answers 500 when the run fails', async () => {
    weekend.runWeekendChecks.mockRejectedValue(new Error('database down'))
    expect((await call('?round=clock_in', 'cron-secret')).status).toBe(500)
  })
})
