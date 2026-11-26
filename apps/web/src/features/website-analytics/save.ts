import { db } from '@ihp/db'
import { lastDays } from './days'
import { readDailyTotals, readDayRankings, type NetlifyDayRankings } from './netlify'
import { NETLIFY_SITES, REPORT_TIME_ZONE } from './sites'

/** The oldest Netlify still answers for totals; the backfill asks for all of it. */
export const MAX_SAVE_DAYS = 89
// Netlify keeps rankings 30 days, and the oldest of those may already be partly gone.
const RANKING_DAYS = 29
const RANKING_BATCH = 5

export interface AnalyticsSaveSummary {
  sites: number
  days: number
  saved: number
  failed: string[]
}

export async function reportOrganizationId(): Promise<string> {
  const slug = process.env.ORG_SLUG
  const named = slug
    ? await db.organization.findFirst({ where: { slug }, select: { id: true } })
    : null
  if (named) return named.id

  const all = await db.organization.findMany({ select: { id: true }, take: 2 })
  const [only] = all
  if (all.length === 1 && only) return only.id
  throw new Error('Set ORG_SLUG to say which organization owns the report sites.')
}

async function rankingsFor(siteId: string, days: readonly string[]) {
  const byDay = new Map<string, NetlifyDayRankings>()
  for (let start = 0; start < days.length; start += RANKING_BATCH) {
    const batch = days.slice(start, start + RANKING_BATCH)
    const read = await Promise.all(
      batch.map((day) => readDayRankings(siteId, day, REPORT_TIME_ZONE)),
    )
    batch.forEach((day, index) => {
      const rankings = read[index]
      if (rankings) byDay.set(day, rankings)
    })
  }
  return byDay
}

/**
 * Saves the last `count` whole days for every Netlify site, overwriting days already saved so a
 * late count is corrected; rankings older than Netlify keeps are left as they were.
 */
export async function saveNetlifyDays(
  count: number,
  now = new Date(),
): Promise<AnalyticsSaveSummary> {
  const days = lastDays(Math.min(Math.max(count, 1), MAX_SAVE_DAYS), now, REPORT_TIME_ZONE)
  const rankingDays = new Set(lastDays(RANKING_DAYS, now, REPORT_TIME_ZONE))
  const first = days[0]
  const last = days.at(-1)
  const summary: AnalyticsSaveSummary = {
    sites: NETLIFY_SITES.length,
    days: days.length,
    saved: 0,
    failed: [],
  }
  if (!first || !last) return summary

  const organizationId = await reportOrganizationId()

  for (const site of NETLIFY_SITES) {
    try {
      const totals = await readDailyTotals(site.sourceId, first, last, REPORT_TIME_ZONE)
      const rankings = await rankingsFor(
        site.sourceId,
        totals.map((total) => total.day).filter((day) => rankingDays.has(day)),
      )

      for (const total of totals) {
        const ranked = rankings.get(total.day)
        // Netlify forgets visitors and rankings after a month, so an empty answer for a busy day
        // must never overwrite what an earlier night saved.
        const rankedKept =
          ranked && (total.pageviews === 0 || ranked.pages.length > 0 || ranked.sources.length > 0)
        const data = {
          pageviews: total.pageviews,
          ...(total.visitors === null ? {} : { visitors: total.visitors }),
          bandwidthBytes: BigInt(total.bandwidthBytes),
          ...(rankedKept
            ? { sources: ranked.sources, pages: ranked.pages, countries: ranked.countries }
            : {}),
        }
        const day = new Date(`${total.day}T00:00:00.000Z`)
        await db.websiteAnalyticsDay.upsert({
          where: { netlifySiteId_day: { netlifySiteId: site.sourceId, day } },
          create: { organizationId, netlifySiteId: site.sourceId, day, visitors: 0, ...data },
          update: { ...data, savedAt: now },
        })
        summary.saved += 1
      }
    } catch (error) {
      console.error(`[website-analytics] could not save ${site.name}`, error)
      summary.failed.push(site.name)
    }
  }

  return summary
}
