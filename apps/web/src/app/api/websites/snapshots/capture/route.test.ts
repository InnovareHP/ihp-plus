import { beforeEach, describe, expect, it, vi } from 'vitest'

const snapshot = vi.hoisted(() => ({ captureSnapshots: vi.fn() }))
const service = vi.hoisted(() => ({ sweepOldSnapshots: vi.fn(async () => 0) }))
const cron = vi.hoisted(() => ({ isAuthorizedCron: vi.fn(() => true) }))
const scheduled = vi.hoisted(() => ({ tasks: [] as (() => Promise<void>)[] }))

vi.mock('@/features/websites/snapshot', () => snapshot)
vi.mock('@/features/websites/service', () => service)
vi.mock('@/lib/cron', () => cron)
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => Promise<void>) => scheduled.tasks.push(task),
}))

const { POST } = await import('./route')

const JOB = {
  organizationId: 'org-1',
  dateKey: '2026-11-03',
  round: 'clock_in',
  websiteIds: ['site-1', 'site-2'],
}

function send(body: unknown) {
  return POST(
    new Request('https://portal.test/api/websites/snapshots/capture', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

describe('POST /api/websites/snapshots/capture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scheduled.tasks = []
    snapshot.captureSnapshots.mockResolvedValue({ captured: 2, failed: 0 })
  })

  it('accepts the batch at once and captures it after answering', async () => {
    const response = await send(JOB)

    expect(response.status).toBe(202)
    expect(snapshot.captureSnapshots).not.toHaveBeenCalled()
    await scheduled.tasks[0]?.()
    expect(snapshot.captureSnapshots).toHaveBeenCalledWith(JOB)
    expect(service.sweepOldSnapshots).toHaveBeenCalledWith('org-1')
  })

  it('still sweeps old pictures when the capture fails', async () => {
    snapshot.captureSnapshots.mockRejectedValueOnce(new Error('no browser'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await send(JOB)
    await scheduled.tasks[0]?.()

    expect(service.sweepOldSnapshots).toHaveBeenCalledWith('org-1')
  })

  it('turns away a caller without the secret', async () => {
    cron.isAuthorizedCron.mockReturnValueOnce(false)

    expect((await send(JOB)).status).toBe(401)
    expect(scheduled.tasks).toHaveLength(0)
  })

  it('refuses a batch that does not say what to capture', async () => {
    expect((await send({ ...JOB, round: 'lunch' })).status).toBe(400)
    expect((await send({ ...JOB, websiteIds: [] })).status).toBe(400)
    expect((await send({ ...JOB, dateKey: 'yesterday' })).status).toBe(400)
    expect(scheduled.tasks).toHaveLength(0)
  })
})
