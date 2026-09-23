import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const calendar = vi.hoisted(() => ({ fillUpcomingHolidays: vi.fn() }))

vi.mock('@/features/attendance/holiday-calendar', () => calendar)

const { GET } = await import('./route')

function call(token?: string) {
  return GET(
    new Request('https://portal.test/api/cron/holidays', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )
}

describe('GET /api/cron/holidays', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    calendar.fillUpcomingHolidays.mockResolvedValue(18)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('fills the coming years for the scheduler holding the secret', async () => {
    const response = await call('cron-secret')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ added: 18 })
  })

  it('refuses anyone without the secret', async () => {
    expect((await call('wrong')).status).toBe(401)
    expect((await call()).status).toBe(401)
    expect(calendar.fillUpcomingHolidays).not.toHaveBeenCalled()
  })

  it('answers 500 when a run fails, so the scheduler logs it', async () => {
    calendar.fillUpcomingHolidays.mockRejectedValue(new Error('database down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await call('cron-secret')).status).toBe(500)
  })
})
