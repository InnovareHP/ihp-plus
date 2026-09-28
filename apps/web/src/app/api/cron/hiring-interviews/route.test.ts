import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const job = vi.hoisted(() => ({ sendInterviewReminders: vi.fn() }))

vi.mock('@/features/hiring/interview-reminders', () => job)

const { GET } = await import('./route')

function call(token?: string) {
  return GET(
    new Request('https://portal.test/api/cron/hiring-interviews', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )
}

describe('GET /api/cron/hiring-interviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    job.sendInterviewReminders.mockResolvedValue({ reminded: 2, asked: 1 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends the hour’s interview reminders for the scheduler holding the secret', async () => {
    const response = await call('cron-secret')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ reminded: 2, asked: 1 })
  })

  it('refuses anyone without the secret', async () => {
    expect((await call('wrong')).status).toBe(401)
    expect((await call()).status).toBe(401)
    expect(job.sendInterviewReminders).not.toHaveBeenCalled()
  })

  it('answers 500 when a run fails, so the scheduler logs it', async () => {
    job.sendInterviewReminders.mockRejectedValue(new Error('database down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await call('cron-secret')).status).toBe(500)
  })
})
