import { db } from '@ihp/db'
import { workDateKey } from '@ihp/clock'
import { after } from 'next/server'
import { isTeamLead } from '@/features/teams/leads'
import { itTeamIdOf } from './access'
import { probeWebsite } from './probe'
import type { CheckRound } from './schema'
import { verdictOf } from './utils/verdict'

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
  return workDateKey(new Date(), await timeZoneOf(organizationId))
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

  return { today, checked: sites.length }
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
      await runRoundFor(checker, round)
    } catch (error) {
      // The punch already succeeded; the lead can rerun the round from the page.
      console.error('[websites] automatic round failed', error)
    }
  })
  return true
}
