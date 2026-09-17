import { after, NextResponse } from 'next/server'
import { track } from '@/lib/analytics'
import { driveEvents } from '@/features/drive/events'
import { notificationBatchSchema } from '@/features/drive/schema'
import { subscriptionByGraphId } from '@/features/drive/service'
import { ensureDriveSubscription } from '@/features/drive/subscription'
import { syncDrive } from '@/features/drive/sync'

// Graph decides this endpoint is dead if it is slow or cached, so nothing here may be static.
export const dynamic = 'force-dynamic'

/** Graph gives up on a notification endpoint that does not answer quickly. */
function accepted() {
  return new NextResponse(null, { status: 202 })
}

export async function POST(request: Request) {
  const validationToken = new URL(request.url).searchParams.get('validationToken')
  // The handshake: Graph subscribes only if the token comes straight back as plain text.
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
  }

  const parsed = notificationBatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json({ error: 'Malformed notification.' }, { status: 400 })

  const drives = new Set<string>()
  const lapsed: { organizationId: string; driveId: string }[] = []

  for (const notification of parsed.data.value) {
    const subscription = await subscriptionByGraphId(notification.subscriptionId)
    // clientState is the shared secret: anyone can POST here, only Graph knows this value.
    if (!subscription || subscription.clientState !== notification.clientState) {
      track(driveEvents.notificationRejected, { subscriptionId: notification.subscriptionId })
      continue
    }

    if (notification.lifecycleEvent === 'subscriptionRemoved') {
      lapsed.push({
        organizationId: subscription.organizationId,
        driveId: subscription.driveId,
      })
    }
    // `missed` means Graph dropped notifications, which a delta sweep recovers by itself.
    if (notification.lifecycleEvent !== 'reauthorizationRequired') drives.add(subscription.driveId)
  }

  // Answered first, swept after: the work outlives the response Graph is waiting on.
  after(async () => {
    for (const subscription of lapsed) {
      await ensureDriveSubscription(subscription.organizationId, subscription.driveId)
    }
    for (const driveId of drives) {
      await syncDrive(driveId)
    }
  })

  return accepted()
}
