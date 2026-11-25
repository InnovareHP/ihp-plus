'use server'

import { db } from '@ihp/db'
import { websitesAccess } from '@/features/websites/access'
import { daysIn, dayKeyOf, previousRange, type DayRange } from './days'
import { Ga4Error, readGa4Report, type Ga4Report } from './ga4'
import { GoogleAuthError } from './google-auth'
import { buildNetlifyReport, type NetlifyReport } from './netlify-report'
import { MAX_RANGE_DAYS } from './report-range'
import { REPORT_SITES, REPORT_TIME_ZONE, type ReportSource } from './sites'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }

const NOT_ADMIN = 'Only an admin can read website analytics.'
const BAD_RANGE = 'Pick a range of whole days up to yesterday, a year or less long.'
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

type Checked =
  | { ok: false; message: string }
  | {
      ok: true
      organizationId: string | undefined
      site: (typeof REPORT_SITES)[number]
      range: DayRange
    }

// The browser's range is checked again here, since anyone can call an action with any arguments.
async function checked(
  siteKey: string,
  start: string,
  end: string,
  source: ReportSource,
): Promise<Checked> {
  const caller = await websitesAccess()
  if (!caller.canViewAnalytics) return { ok: false, message: NOT_ADMIN }

  const site = REPORT_SITES.find((one) => one.key === siteKey && one.source === source)
  if (!site) return { ok: false, message: 'That website is not on the report list.' }

  const today = dayKeyOf(new Date(), REPORT_TIME_ZONE)
  if (
    !DAY_KEY.test(start) ||
    !DAY_KEY.test(end) ||
    start > end ||
    end >= today ||
    daysIn({ start, end }) > MAX_RANGE_DAYS
  ) {
    return { ok: false, message: BAD_RANGE }
  }
  return { ok: true, organizationId: caller.organizationId, site, range: { start, end } }
}

/** One GA4 site's report for a range, read live from Google for an admin. */
export async function loadGa4Report(
  siteKey: string,
  start: string,
  end: string,
): Promise<Result<Ga4Report>> {
  const check = await checked(siteKey, start, end, 'ga4')
  if (!check.ok) return check
  const { site, range } = check

  try {
    return { ok: true, data: await readGa4Report(site, range) }
  } catch (error) {
    if (error instanceof Ga4Error || error instanceof GoogleAuthError) {
      return {
        ok: false,
        message: `Could not read ${site.name} from Google Analytics: ${error.message}`,
      }
    }
    console.error('website analytics: GA4 report failed', error)
    return {
      ok: false,
      message: `Could not read ${site.name} from Google Analytics. Try again in a minute.`,
    }
  }
}

/** One Netlify site's report for a range, from the days the nightly job saved. */
export async function loadNetlifyReport(
  siteKey: string,
  start: string,
  end: string,
): Promise<Result<NetlifyReport>> {
  const check = await checked(siteKey, start, end, 'netlify')
  if (!check.ok) return check
  const { organizationId, site, range } = check
  if (!organizationId) return { ok: false, message: NOT_ADMIN }

  const previous = previousRange(range)
  try {
    const rows = await db.websiteAnalyticsDay.findMany({
      where: {
        organizationId,
        netlifySiteId: site.sourceId,
        day: {
          gte: new Date(`${previous.start}T00:00:00.000Z`),
          lte: new Date(`${range.end}T00:00:00.000Z`),
        },
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
    return { ok: true, data: buildNetlifyReport(saved, range, previous) }
  } catch (error) {
    console.error('website analytics: Netlify report failed', error)
    return {
      ok: false,
      message: `Could not read the saved Netlify numbers for ${site.name}. Try again in a minute.`,
    }
  }
}
