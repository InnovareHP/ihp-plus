import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const save = vi.hoisted(() => ({ MAX_SAVE_DAYS: 89, saveNetlifyDays: vi.fn() }))

vi.mock('@/features/website-analytics/save', () => save)

const { GET } = await import('./route')

function call(query: string, token?: string) {
  return GET(
    new Request(`https://portal.test/api/cron/website-analytics${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )
}

const SUMMARY = { sites: 8, days: 2, saved: 16, failed: [] }

describe('GET /api/cron/website-analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    vi.stubEnv('NETLIFY_API_TOKEN', 'token-1')
    save.saveNetlifyDays.mockResolvedValue(SUMMARY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('saves the last two days by default', async () => {
    const response = await call('', 'cron-secret')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(SUMMARY)
    expect(save.saveNetlifyDays).toHaveBeenCalledWith(2)
  })

  it('backfills as many days as asked, up to what Netlify keeps', async () => {
    await call('?days=89', 'cron-secret')

    expect(save.saveNetlifyDays).toHaveBeenCalledWith(89)
  })

  it('refuses anyone without the secret', async () => {
    expect((await call('', 'wrong')).status).toBe(401)
    expect(save.saveNetlifyDays).not.toHaveBeenCalled()
  })

  it('refuses a day count outside 1 to 89', async () => {
    for (const query of ['?days=0', '?days=90', '?days=two', '?days=1.5']) {
      expect((await call(query, 'cron-secret')).status).toBe(400)
    }
    expect(save.saveNetlifyDays).not.toHaveBeenCalled()
  })

  it('says so when no Netlify token is set', async () => {
    vi.stubEnv('NETLIFY_API_TOKEN', '')

    expect((await call('', 'cron-secret')).status).toBe(503)
    expect(save.saveNetlifyDays).not.toHaveBeenCalled()
  })

  it('reports failure when every site failed', async () => {
    save.saveNetlifyDays.mockResolvedValue({ ...SUMMARY, saved: 0, failed: ['A', 'B'], sites: 2 })

    expect((await call('', 'cron-secret')).status).toBe(502)
  })

  it('answers 500 when the save itself throws', async () => {
    save.saveNetlifyDays.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await call('', 'cron-secret')).status).toBe(500)
  })
})
