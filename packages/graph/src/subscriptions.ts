import { graphJson, graphVoid } from './client'
import type { GraphSubscription } from './types'

/** Graph caps a driveItem subscription here, so something has to renew it every day. */
export const MAX_SUBSCRIPTION_MINUTES = 4230
const RENEW_MARGIN_MINUTES = 60

export function subscriptionExpiry(minutes = MAX_SUBSCRIPTION_MINUTES) {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

/** True once the subscription is inside the margin a renewal run must catch it in. */
export function needsRenewal(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() - now.getTime() <= RENEW_MARGIN_MINUTES * 60_000
}

/** SharePoint and OneDrive for Business allow the drive root only — not a subfolder. */
export function createDriveSubscription(options: {
  driveId: string
  notificationUrl: string
  clientState: string
  minutes?: number
}) {
  return graphJson<GraphSubscription>('/subscriptions', {
    method: 'POST',
    body: {
      changeType: 'updated',
      notificationUrl: options.notificationUrl,
      resource: `/drives/${options.driveId}/root`,
      expirationDateTime: subscriptionExpiry(options.minutes),
      clientState: options.clientState,
    },
  })
}

export function renewSubscription(subscriptionId: string, minutes = MAX_SUBSCRIPTION_MINUTES) {
  return graphJson<GraphSubscription>(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: { expirationDateTime: subscriptionExpiry(minutes) },
  })
}

export function deleteSubscription(subscriptionId: string) {
  return graphVoid(`/subscriptions/${subscriptionId}`, { method: 'DELETE' })
}

export function getSubscription(subscriptionId: string) {
  return graphJson<GraphSubscription>(`/subscriptions/${subscriptionId}`)
}
