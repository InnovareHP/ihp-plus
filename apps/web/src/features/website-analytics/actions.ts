'use server'

import { websitesAccess } from '@/features/websites/access'
import { daysIn, dayKeyOf } from './days'
import { Ga4Error, readGa4Report, type Ga4Report } from './ga4'
import { GoogleAuthError } from './google-auth'
import { MAX_RANGE_DAYS } from './report-range'
import { REPORT_SITES, REPORT_TIME_ZONE } from './sites'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }

const NOT_ADMIN = 'Only an admin can read website analytics.'
const BAD_RANGE = 'Pick a range of whole days up to yesterday, a year or less long.'
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** One GA4 site's report for a range, read live from Google for an admin. */
export async function loadGa4Report(
  siteKey: string,
  start: string,
  end: string,
): Promise<Result<Ga4Report>> {
  const caller = await websitesAccess()
  if (!caller.canViewAnalytics) return { ok: false, message: NOT_ADMIN }

  const site = REPORT_SITES.find((one) => one.key === siteKey && one.source === 'ga4')
  if (!site) return { ok: false, message: 'That website does not report through Google Analytics.' }

  // The browser's range is checked again here, since anyone can call an action with any arguments.
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

  try {
    return { ok: true, data: await readGa4Report(site, { start, end }) }
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
