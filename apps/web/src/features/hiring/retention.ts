import { db } from '@ihp/db'
import { deleteObject } from '@/lib/s3'
import { requestLandingRebuild } from './landing-rebuild'

const DAY_MS = 24 * 60 * 60 * 1000
// What the consent line on the careers form promises: kept 12 months after the decision.
export const RETENTION_MS = 365 * DAY_MS
// Uploads are claimed within the day or never; past that they belong to nobody.
export const STRAY_UPLOAD_MS = DAY_MS
// One run's worth; a backlog clears over the following days rather than in one long request.
const BATCH = 500

async function deleteFiles(keys: readonly string[]) {
  let failed = 0
  for (const key of keys) {
    try {
      await deleteObject(key)
    } catch (error) {
      failed += 1
      console.error(`[hiring] could not delete ${key} from storage`, error)
    }
  }
  return failed
}

/**
 * Deletes applications decided more than 12 months ago, with their files, notes and history,
 * and uploads nobody sent. Storage is cleared before the rows, so a failure leaves a row to
 * retry tomorrow rather than a file no row points at.
 */
export async function sweepHiringData(now = new Date()) {
  const expired = await db.jobApplication.findMany({
    where: {
      status: { not: 'active' },
      decidedAt: { lt: new Date(now.getTime() - RETENTION_MS) },
    },
    select: { id: true, attachments: { select: { fileKey: true } } },
    take: BATCH,
  })
  const expiredFailures = await deleteFiles(
    expired.flatMap((application) => application.attachments.map((file) => file.fileKey)),
  )
  if (expired.length > 0 && expiredFailures === 0) {
    // Attachments, notes and history go with it through the cascade.
    await db.jobApplication.deleteMany({
      where: { id: { in: expired.map((application) => application.id) } },
    })
  }

  const strays = await db.applicationAttachment.findMany({
    where: { applicationId: null, createdAt: { lt: new Date(now.getTime() - STRAY_UPLOAD_MS) } },
    select: { id: true, fileKey: true },
    take: BATCH,
  })
  const strayFailures = await deleteFiles(strays.map((file) => file.fileKey))
  if (strays.length > 0 && strayFailures === 0) {
    await db.applicationAttachment.deleteMany({
      where: { id: { in: strays.map((file) => file.id) } },
    })
  }

  // A posting past its closing date drops off the marketing site only when that site rebuilds.
  const closedByDate = await db.jobPosting.count({
    where: {
      status: 'open',
      closesAt: { gte: new Date(now.getTime() - 2 * DAY_MS), lt: now },
    },
  })
  if (closedByDate > 0) requestLandingRebuild('closing date passed')

  return {
    applications: expiredFailures === 0 ? expired.length : 0,
    strayFiles: strayFailures === 0 ? strays.length : 0,
  }
}
