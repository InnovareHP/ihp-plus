import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDriveSubscription,
  MAX_SUBSCRIPTION_MINUTES,
  needsRenewal,
  subscriptionExpiry,
} from './subscriptions'
import { getAccessToken, resetTokenCache } from './token'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  process.env.GRAPH_TENANT_ID = 'tenant-1'
  process.env.GRAPH_CLIENT_ID = 'client-1'
  process.env.GRAPH_CLIENT_SECRET = 'secret-1'
  resetTokenCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'token-1', expires_in: 3600 }))
  await getAccessToken()
  fetchMock.mockClear()
})

describe('subscriptionExpiry', () => {
  it('stays inside the 4230 minutes Graph allows a driveItem subscription', () => {
    const minutes = (Date.parse(subscriptionExpiry()) - Date.now()) / 60_000

    expect(minutes).toBeLessThanOrEqual(MAX_SUBSCRIPTION_MINUTES)
    expect(minutes).toBeGreaterThan(MAX_SUBSCRIPTION_MINUTES - 1)
  })
})

describe('needsRenewal', () => {
  it('is false while the subscription has more than an hour left', () => {
    expect(needsRenewal(new Date(Date.now() + 5 * 60 * 60_000))).toBe(false)
  })

  it('is true inside the renewal margin, so a daily run always catches it', () => {
    expect(needsRenewal(new Date(Date.now() + 30 * 60_000))).toBe(true)
  })

  it('is true for a subscription that already lapsed', () => {
    expect(needsRenewal(new Date(Date.now() - 60_000))).toBe(true)
  })
})

describe('createDriveSubscription', () => {
  it('subscribes to the drive root, which is the only resource SharePoint allows', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'sub-1', resource: '/drives/drive-1/root', expirationDateTime: 'later' }),
    )

    const subscription = await createDriveSubscription({
      driveId: 'drive-1',
      notificationUrl: 'https://portal.test/app/api/graph/drive',
      clientState: 'secret-state',
    })

    expect(subscription.id).toBe('sub-1')
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string)
    expect(body).toMatchObject({
      resource: '/drives/drive-1/root',
      changeType: 'updated',
      clientState: 'secret-state',
      notificationUrl: 'https://portal.test/app/api/graph/drive',
    })
  })
})
