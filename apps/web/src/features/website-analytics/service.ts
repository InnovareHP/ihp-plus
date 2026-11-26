import { db } from '@ihp/db'
import { previousRange, type DayRange } from './days'
import { readGa4Report, type Ga4Report } from './ga4'
import { buildNetlifyReport, type NetlifyReport } from './netlify-report'
import type { SavedTakeaways, TakeawaysValues } from './schema'
import type { ReportSite } from './sites'

const dateOf = (dayKey: string) => new Date(`${dayKey}T00:00:00.000Z`)

export type SiteReport =
  { source: 'ga4'; report: Ga4Report } | { source: 'netlify'; report: NetlifyReport }

/** One Netlify site's report from the days the nightly job saved for this organization. */
export async function netlifyReportFor(
  organizationId: string,
  site: ReportSite,
  range: DayRange,
): Promise<NetlifyReport> {
  const previous = previousRange(range)
  const rows = await db.websiteAnalyticsDay.findMany({
    where: {
      organizationId,
      netlifySiteId: site.sourceId,
      day: { gte: dateOf(previous.start), lte: dateOf(range.end) },
    },
    orderBy: { day: 'asc' },
  })
  const saved = rows.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    pageviews: row.pageviews,
    visitors: row.visitors,
    // A BigInt cannot cross to the browser, and no site comes near 2^53 bytes.
    bandwidthBytes: Number(row.bandwidthBytes),
    sources: row.sources,
    pages: row.pages,
    countries: row.countries,
  }))
  return buildNetlifyReport(saved, range, previous)
}

/** Either kind of site's report, read the way its source keeps it. */
export async function siteReportFor(
  organizationId: string,
  site: ReportSite,
  range: DayRange,
): Promise<SiteReport> {
  return site.source === 'ga4'
    ? { source: 'ga4', report: await readGa4Report(site, range) }
    : { source: 'netlify', report: await netlifyReportFor(organizationId, site, range) }
}

const rangeKey = (organizationId: string, siteKey: string, range: DayRange) => ({
  organizationId_siteKey_start_end: {
    organizationId,
    siteKey,
    start: dateOf(range.start),
    end: dateOf(range.end),
  },
})

export async function takeawaysFor(
  organizationId: string,
  siteKey: string,
  range: DayRange,
): Promise<SavedTakeaways | null> {
  const row = await db.websiteReportTakeaways.findUnique({
    where: rangeKey(organizationId, siteKey, range),
  })
  if (!row) return null
  return {
    observations: row.observations,
    strengths: row.strengths,
    improvements: row.improvements,
    recommendations: row.recommendations,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function saveTakeaways(
  organizationId: string,
  userId: string,
  siteKey: string,
  range: DayRange,
  values: TakeawaysValues,
): Promise<SavedTakeaways> {
  const row = await db.websiteReportTakeaways.upsert({
    where: rangeKey(organizationId, siteKey, range),
    create: {
      organizationId,
      siteKey,
      start: dateOf(range.start),
      end: dateOf(range.end),
      updatedById: userId,
      ...values,
    },
    update: { ...values, updatedById: userId },
  })
  return { ...values, updatedAt: row.updatedAt.toISOString() }
}

/** The site keys with takeaways saved for exactly this range. */
export async function sitesWithTakeaways(organizationId: string, range: DayRange) {
  const rows = await db.websiteReportTakeaways.findMany({
    where: { organizationId, start: dateOf(range.start), end: dateOf(range.end) },
    select: { siteKey: true },
  })
  return rows.map((row) => row.siteKey)
}
