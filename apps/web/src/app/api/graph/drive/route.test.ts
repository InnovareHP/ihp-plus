import { beforeEach, describe, expect, it, vi } from 'vitest'

const drive = vi.hoisted(() => ({
  subscriptionByGraphId: vi.fn(),
  syncDrive: vi.fn(),
  ensureDriveSubscription: vi.fn(),
  track: vi.fn(),
}))

// after() runs the callback immediately here, so a test can assert on what the sweep did.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => callback(),
}))
vi.mock('@/features/drive/service', () => ({
  subscriptionByGraphId: drive.subscriptionByGraphId,
}))
vi.mock('@/features/drive/sync', () => ({ syncDrive: drive.syncDrive }))
vi.mock('@/features/drive/subscription', () => ({
  ensureDriveSubscription: drive.ensureDriveSubscription,
}))
vi.mock('@/lib/analytics', () => ({ track: drive.track }))

const { POST } = await import('./route')

const SUBSCRIPTION = {
  organizationId: 'org-1',
  driveId: 'internal-drive',
  subscriptionId: 'sub-1',
  clientState: 'shared-secret',
}

function notification(body: unknown) {
  return new Request('https://portal.test/api/graph/drive', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  drive.subscriptionByGraphId.mockResolvedValue(SUBSCRIPTION)
})

describe('POST /api/graph/drive', () => {
  it('echoes the validation token as plain text, which is how Graph accepts the endpoint', async () => {
    const response = await POST(
      new Request('https://portal.test/api/graph/drive?validationToken=abc%20123', {
        method: 'POST',
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(await response.text()).toBe('abc 123')
    expect(drive.syncDrive).not.toHaveBeenCalled()
  })

  it('answers 202 and sweeps the drive the notification named', async () => {
    const response = await POST(
      notification({ value: [{ subscriptionId: 'sub-1', clientState: 'shared-secret' }] }),
    )

    expect(response.status).toBe(202)
    expect(drive.syncDrive).toHaveBeenCalledWith('internal-drive')
  })

  it('ignores a notification whose clientState does not match the stored one', async () => {
    const response = await POST(
      notification({ value: [{ subscriptionId: 'sub-1', clientState: 'guessed' }] }),
    )

    expect(response.status).toBe(202)
    expect(drive.syncDrive).not.toHaveBeenCalled()
    expect(drive.track).toHaveBeenCalledWith(
      'drive.webhook.notification_rejected',
      expect.anything(),
    )
  })

  it('ignores a notification for a subscription it never created', async () => {
    drive.subscriptionByGraphId.mockResolvedValue(null)

    await POST(notification({ value: [{ subscriptionId: 'sub-9', clientState: 'shared-secret' }] }))

    expect(drive.syncDrive).not.toHaveBeenCalled()
  })

  it('sweeps once when Graph batches several changes to the same drive', async () => {
    await POST(
      notification({
        value: [
          { subscriptionId: 'sub-1', clientState: 'shared-secret' },
          { subscriptionId: 'sub-1', clientState: 'shared-secret' },
        ],
      }),
    )

    expect(drive.syncDrive).toHaveBeenCalledTimes(1)
  })

  it('recreates a subscription Graph says it removed', async () => {
    await POST(
      notification({
        value: [
          {
            subscriptionId: 'sub-1',
            clientState: 'shared-secret',
            lifecycleEvent: 'subscriptionRemoved',
          },
        ],
      }),
    )

    expect(drive.ensureDriveSubscription).toHaveBeenCalledWith('org-1', 'internal-drive')
  })

  it('rejects a body that is not a notification batch', async () => {
    const response = await POST(notification({ nope: true }))

    expect(response.status).toBe(400)
    expect(drive.syncDrive).not.toHaveBeenCalled()
  })
})
