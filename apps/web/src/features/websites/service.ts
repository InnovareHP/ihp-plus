import { db } from '@ihp/db'
import { absoluteUrl } from '@ihp/email'
import { after } from 'next/server'
import { isTeamLead } from '@/features/teams/leads'
import { WEBSITE_SNAPSHOT_CAPTURE_PATH, withBasePath } from '@/lib/routes'
import { deleteObjects, isObjectStorageConfigured, listObjects } from '@/lib/s3'
import { itTeamIdOf } from './access'
import { probeWebsite } from './probe'
import type { CheckRound } from './schema'
import type { CaptureJob } from './snapshot'
import {
  parseSnapshotKey,
  SNAPSHOT_PREFIX,
  snapshotKey,
  snapshotPrefix,
  type SnapshotSize,
} from './utils/snapshot-key'
import { verdictOf } from './utils/verdict'
import { websiteDayKey } from './utils/work-day'

// Five sites per capture function keeps each one well inside its time limit.
const SNAPSHOT_BATCH = 5

// Enough to finish a long list inside one request without opening every site at once.
const PROBE_CONCURRENCY = 6

// The attendance zone, so "today" here is the same day the lead clocked in on.
export async function timeZoneOf(organizationId: string) {
  const settings = await db.attendanceSettings.findUnique({
    where: { organizationId },
    select: { timeZone: true },
  })
  return settings?.timeZone ?? 'UTC'
}

export async function todayOf(organizationId: string) {
  return websiteDayKey(new Date(), await timeZoneOf(organizationId))
}

async function inBatches<T, R>(items: readonly T[], size: number, run: (item: T) => Promise<R>) {
  const results: R[] = []
  for (let start = 0; start < items.length; start += size) {
    results.push(...(await Promise.all(items.slice(start, start + size).map(run))))
  }
  return results
}

export interface RoundChecker {
  organizationId: string
  userId: string
  userName: string
}

/**
 * Opens every site on the list (or the one asked for) and records what came back as today's
 * check for the round. A rerun replaces the reading but keeps whatever note the lead wrote.
 * Returns how many sites it checked, so a missing single site can be told apart.
 */
export async function runRoundFor(
  checker: RoundChecker,
  round: CheckRound,
  options: { websiteId?: string; onlyUnchecked?: boolean } = {},
) {
  const today = await todayOf(checker.organizationId)
  const workDate = new Date(`${today}T00:00:00.000Z`)
  const sites = await db.website.findMany({
    where: {
      organizationId: checker.organizationId,
      archivedAt: null,
      ...(options.websiteId ? { id: options.websiteId } : {}),
      // An automatic run never overwrites a round someone already checked by hand.
      ...(options.onlyUnchecked ? { checks: { none: { workDate, round } } } : {}),
    },
    select: { id: true, url: true },
  })

  await inBatches(sites, PROBE_CONCURRENCY, async (site) => {
    const reading = await probeWebsite(site.url)
    const result = {
      status: verdictOf(reading),
      httpStatus: reading.httpStatus ?? null,
      responseMs: reading.responseMs ?? null,
      error: reading.error,
      checkedById: checker.userId,
      checkedByName: checker.userName,
      checkedAt: new Date(),
    }
    await db.websiteCheck.upsert({
      where: { websiteId_workDate_round: { websiteId: site.id, workDate, round } },
      create: {
        organizationId: checker.organizationId,
        websiteId: site.id,
        workDate,
        round,
        ...result,
      },
      update: result,
    })
  })

  return { today, checked: sites.length, websiteIds: sites.map((site) => site.id) }
}

/** Whether a round can take pictures here: storage to keep them, the hand-off secret and a browser. */
export function snapshotsEnabled() {
  // Vercel ships Chromium for Linux; anywhere else needs a local Chrome named in the env.
  const hasBrowser = process.platform === 'linux' || Boolean(process.env.SNAPSHOT_CHROME_PATH)
  return Boolean(process.env.CRON_SECRET) && isObjectStorageConfigured() && hasBrowser
}

/**
 * Hands the round's sites to the capture route in small batches, so the browser runs in functions
 * of its own and the check itself never waits on it. Without the setup above it does nothing.
 */
export async function queueSnapshots(job: CaptureJob) {
  const secret = process.env.CRON_SECRET
  if (!secret || !snapshotsEnabled() || job.websiteIds.length === 0) return

  const url = absoluteUrl(withBasePath(WEBSITE_SNAPSHOT_CAPTURE_PATH))
  const batches: string[][] = []
  for (let start = 0; start < job.websiteIds.length; start += SNAPSHOT_BATCH) {
    batches.push(job.websiteIds.slice(start, start + SNAPSHOT_BATCH))
  }

  await Promise.all(
    batches.map(async (websiteIds) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
          body: JSON.stringify({ ...job, websiteIds }),
          signal: AbortSignal.timeout(10_000),
        })
        if (!response.ok) console.error(`[websites] snapshot hand-off answered ${response.status}`)
      } catch (error) {
        // The check is already saved; the card simply shows no picture for this round.
        console.error('[websites] could not hand off snapshots', error)
      }
    }),
  )
}

/** When each site's picture for each round was taken that day, keyed by website id. */
export type SnapshotTimes = Map<string, Partial<Record<CheckRound, string>>>

/** One listing for the whole day; storage trouble only costs the pictures, never the checklist. */
export async function snapshotsOf(
  organizationId: string,
  dateKey: string,
  websiteId?: string,
): Promise<SnapshotTimes> {
  const times: SnapshotTimes = new Map()
  if (!isObjectStorageConfigured()) return times

  try {
    const listed = await listObjects(snapshotPrefix(organizationId, dateKey, websiteId))
    const fulls = new Set<string>()
    const thumbs: { websiteId: string; round: CheckRound; at: Date }[] = []
    for (const item of listed) {
      const parsed = parseSnapshotKey(item.key)
      if (!parsed || !item.lastModified) continue
      if (parsed.size === 'full') fulls.add(`${parsed.websiteId}/${parsed.round}`)
      else thumbs.push({ websiteId: parsed.websiteId, round: parsed.round, at: item.lastModified })
    }
    // The thumb is written last, so its time is when the pair was complete; a lone one is skipped.
    for (const thumb of thumbs) {
      if (!fulls.has(`${thumb.websiteId}/${thumb.round}`)) continue
      times.set(thumb.websiteId, {
        ...times.get(thumb.websiteId),
        [thumb.round]: thumb.at.toISOString(),
      })
    }
  } catch (error) {
    console.error('[websites] could not list snapshots', error)
  }
  return times
}

/** Deletes every snapshot from before its organization's today and says how many files went. */
export async function sweepOldSnapshots(organizationId?: string) {
  if (!isObjectStorageConfigured()) return 0

  const prefix = organizationId ? `${SNAPSHOT_PREFIX}/${organizationId}/` : `${SNAPSHOT_PREFIX}/`
  const byOrganization = new Map<string, { key: string; dateKey: string }[]>()
  for (const item of await listObjects(prefix)) {
    const parsed = parseSnapshotKey(item.key)
    if (!parsed) continue
    const files = byOrganization.get(parsed.organizationId) ?? []
    files.push({ key: item.key, dateKey: parsed.dateKey })
    byOrganization.set(parsed.organizationId, files)
  }

  const stale: string[] = []
  for (const [organization, files] of byOrganization) {
    const today = await todayOf(organization)
    for (const file of files) if (file.dateKey !== today) stale.push(file.key)
  }
  await deleteObjects(stale)
  return stale.length
}

/** The storage key of today's picture, once the site is known to belong to the organization. */
export async function todaysSnapshotKey(
  organizationId: string,
  websiteId: string,
  round: CheckRound,
  size: SnapshotSize,
) {
  const site = await db.website.findFirst({
    where: { id: websiteId, organizationId },
    select: { id: true },
  })
  if (!site) return undefined
  return snapshotKey(organizationId, await todayOf(organizationId), site.id, round, size)
}

/**
 * The time clock calls this on every punch: when the person punching leads IT, the matching
 * round runs once the punch has been answered, so clocking in never waits on slow sites.
 */
export async function queueLeadRound(checker: RoundChecker, round: CheckRound) {
  try {
    const itTeamId = await itTeamIdOf(checker.organizationId)
    if (!itTeamId) return false
    if (!(await isTeamLead(checker.organizationId, checker.userId, itTeamId))) return false
  } catch (error) {
    // The punch is already saved, so a failed lookup must not turn it into an error.
    console.error('[websites] could not tell whether the punch was the IT lead', error)
    return false
  }

  after(async () => {
    try {
      const { today, websiteIds } = await runRoundFor(checker, round)
      await queueSnapshots({
        organizationId: checker.organizationId,
        dateKey: today,
        round,
        websiteIds,
      })
    } catch (error) {
      // The punch already succeeded; the lead can rerun the round from the page.
      console.error('[websites] automatic round failed', error)
    }
  })
  return true
}
