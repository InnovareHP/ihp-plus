import { db } from '@ihp/db'
import {
  createDriveSubscription,
  GraphError,
  MAX_SUBSCRIPTION_MINUTES,
  needsRenewal,
  renewSubscription,
} from '@ihp/graph'
import { track } from '@/lib/analytics'
import { portalUrl } from '@/lib/email'
import { driveEvents } from './events'

/** Graph posts here; it has to be a public HTTPS URL, so localhost needs a tunnel. */
export function notificationUrl() {
  return process.env.GRAPH_NOTIFICATION_URL ?? portalUrl('/api/graph/drive')
}

/** Starts watching a drive, or replaces a subscription that has lapsed. */
export async function ensureDriveSubscription(organizationId: string, driveId: string) {
  const existing = await db.driveSubscription.findUnique({ where: { driveId } })
  if (existing && !needsRenewal(existing.expiresAt)) return existing

  const clientState = existing?.clientState ?? crypto.randomUUID()
  const subscription = await createDriveSubscription({
    driveId,
    notificationUrl: notificationUrl(),
    clientState,
  })

  track(driveEvents.subscriptionCreated, { driveId })

  return db.driveSubscription.upsert({
    where: { driveId },
    create: {
      organizationId,
      driveId,
      subscriptionId: subscription.id,
      clientState,
      expiresAt: new Date(subscription.expirationDateTime),
    },
    update: {
      organizationId,
      subscriptionId: subscription.id,
      clientState,
      expiresAt: new Date(subscription.expirationDateTime),
      lastError: null,
    },
  })
}

/**
 * Graph expires a driveItem subscription after 4230 minutes, so this has to run daily. A
 * subscription Graph has already forgotten is recreated rather than renewed.
 */
export async function renewDriveSubscriptions() {
  const due = await db.driveSubscription.findMany({
    where: { expiresAt: { lte: new Date(Date.now() + 60 * 60_000) } },
  })

  const renewed: string[] = []
  const failed: { driveId: string; message: string }[] = []

  for (const subscription of due) {
    try {
      const updated = await renewSubscription(subscription.subscriptionId, MAX_SUBSCRIPTION_MINUTES)
      await db.driveSubscription.update({
        where: { id: subscription.id },
        data: { expiresAt: new Date(updated.expirationDateTime), lastError: null },
      })
      track(driveEvents.subscriptionRenewed, { driveId: subscription.driveId })
      renewed.push(subscription.driveId)
    } catch (error) {
      if (error instanceof GraphError && (error.isNotFound || error.status === 410)) {
        await ensureDriveSubscription(subscription.organizationId, subscription.driveId)
        renewed.push(subscription.driveId)
        continue
      }

      const message = error instanceof Error ? error.message : 'Unknown error.'
      await db.driveSubscription.update({
        where: { id: subscription.id },
        data: { lastError: message.slice(0, 500) },
      })
      track(driveEvents.subscriptionRenewFailed, { driveId: subscription.driveId })
      failed.push({ driveId: subscription.driveId, message })
    }
  }

  return { renewed, failed }
}
