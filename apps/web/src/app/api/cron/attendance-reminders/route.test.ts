import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reminders = vi.hoisted(() => ({ sendDueReminders: vi.fn() }))

vi.mock('@/features/attendance/reminders', () => reminders)

const { GET } = await import('./route')

function call(token?: string) {
  return GET(
    new Request('https://portal.test/api/cron/attendance-reminders', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )
}

describe('GET /api/cron/attendance-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    reminders.sendDueReminders.mockResolvedValue(3)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends the due reminders for the scheduler holding the secret', async () => {
    const response = await call('cron-secret')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sent: 3 })
  })

  it('refuses anyone without the secret, or any caller when none is set', async () => {
    expect((await call('wrong')).status).toBe(401)
    expect((await call()).status).toBe(401)

    vi.stubEnv('CRON_SECRET', '')
    expect((await call('')).status).toBe(401)
    expect(reminders.sendDueReminders).not.toHaveBeenCalled()
  })

  it('answers 500 when a run fails, so the scheduler logs it', async () => {
    reminders.sendDueReminders.mockRejectedValue(new Error('database down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await call('cron-secret')).status).toBe(500)
  })
})
