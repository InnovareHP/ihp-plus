'use server'

import { zipSync } from 'fflate'
import { letterheadPdf } from '@/features/letterhead/utils/letterhead-pdf'
import { LETTERHEAD_LAYOUTS } from '@/features/letterhead/utils/letterhead-templates'
import { websitesAccess } from '@/features/websites/access'
import { daysIn, dayKeyOf, type DayRange } from './days'
import { Ga4Error, readGa4Report, type Ga4Report } from './ga4'
import { GoogleAuthError } from './google-auth'
import type { NetlifyReport } from './netlify-report'
import { MAX_RANGE_DAYS } from './report-range'
import { takeawaysSchema, type SavedTakeaways, type TakeawaysValues } from './schema'
import {
  netlifyReportFor,
  saveTakeaways as saveTakeawaysRow,
  siteReportFor,
  sitesWithTakeaways,
  takeawaysFor,
} from './service'
import { REPORT_SITES, REPORT_TIME_ZONE, type ReportSite, type ReportSource } from './sites'
import { reportFileName, reportPdf } from './utils/report-pdf'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }

const NOT_ADMIN = 'Only an admin can read website analytics.'
const BAD_RANGE = 'Pick a range of whole days up to yesterday, a year or less long.'
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

interface Caller {
  organizationId: string
  userId: string
}

type Checked<T> = { ok: false; message: string } | ({ ok: true } & T)

// The browser's range is checked again here, since anyone can call an action with any arguments.
async function checkedRange(
  start: string,
  end: string,
): Promise<Checked<Caller & { range: DayRange }>> {
  const caller = await websitesAccess()
  if (!caller.canViewAnalytics || !caller.organizationId) return { ok: false, message: NOT_ADMIN }

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
  return {
    ok: true,
    organizationId: caller.organizationId,
    userId: caller.userId,
    range: { start, end },
  }
}

async function checked(
  siteKey: string,
  start: string,
  end: string,
  source?: ReportSource,
): Promise<Checked<Caller & { range: DayRange; site: ReportSite }>> {
  const check = await checkedRange(start, end)
  if (!check.ok) return check
  const site = REPORT_SITES.find((one) => one.key === siteKey && (!source || one.source === source))
  if (!site) return { ok: false, message: 'That website is not on the report list.' }
  return { ...check, site }
}

function readFailure(site: ReportSite, error: unknown): { ok: false; message: string } {
  if (error instanceof Ga4Error || error instanceof GoogleAuthError) {
    return {
      ok: false,
      message: `Could not read ${site.name} from Google Analytics: ${error.message}`,
    }
  }
  console.error(`website analytics: ${site.source} report failed`, error)
  return {
    ok: false,
    message:
      site.source === 'ga4'
        ? `Could not read ${site.name} from Google Analytics. Try again in a minute.`
        : `Could not read the saved Netlify numbers for ${site.name}. Try again in a minute.`,
  }
}

/** One GA4 site's report for a range, read live from Google for an admin. */
export async function loadGa4Report(
  siteKey: string,
  start: string,
  end: string,
): Promise<Result<Ga4Report>> {
  const check = await checked(siteKey, start, end, 'ga4')
  if (!check.ok) return check
  try {
    return { ok: true, data: await readGa4Report(check.site, check.range) }
  } catch (error) {
    return readFailure(check.site, error)
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
  try {
    return {
      ok: true,
      data: await netlifyReportFor(check.organizationId, check.site, check.range),
    }
  } catch (error) {
    return readFailure(check.site, error)
  }
}

/** The takeaways saved for one site and exactly this range, or null when none are yet. */
export async function loadTakeaways(
  siteKey: string,
  start: string,
  end: string,
): Promise<Result<SavedTakeaways | null>> {
  const check = await checked(siteKey, start, end)
  if (!check.ok) return check
  try {
    return { ok: true, data: await takeawaysFor(check.organizationId, siteKey, check.range) }
  } catch (error) {
    console.error('website analytics: loading takeaways failed', error)
    return { ok: false, message: 'Could not load the saved takeaways. Try again in a minute.' }
  }
}

export async function saveTakeaways(
  siteKey: string,
  start: string,
  end: string,
  values: TakeawaysValues,
): Promise<Result<SavedTakeaways>> {
  const check = await checked(siteKey, start, end)
  if (!check.ok) return check
  const parsed = takeawaysSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the takeaways.' }
  }
  try {
    return {
      ok: true,
      data: await saveTakeawaysRow(
        check.organizationId,
        check.userId,
        siteKey,
        check.range,
        parsed.data,
      ),
    }
  } catch (error) {
    console.error('website analytics: saving takeaways failed', error)
    return { ok: false, message: 'Could not save the takeaways. Try again in a minute.' }
  }
}

/** Which sites already have takeaways for this range, so Download all can say what is missing. */
export async function loadTakeawayStatus(start: string, end: string): Promise<Result<string[]>> {
  const check = await checkedRange(start, end)
  if (!check.ok) return check
  try {
    return { ok: true, data: await sitesWithTakeaways(check.organizationId, check.range) }
  } catch (error) {
    console.error('website analytics: takeaway status failed', error)
    return { ok: false, message: 'Could not check which takeaways are saved.' }
  }
}

export interface ReportFile {
  fileName: string
  bytes: Uint8Array
}

async function letterheadedReport(organizationId: string, site: ReportSite, range: DayRange) {
  const [read, takeaways] = await Promise.all([
    siteReportFor(organizationId, site, range),
    takeawaysFor(organizationId, site.key, range),
  ])
  const bytes = await reportPdf(site, read, takeaways)
  return letterheadPdf(bytes, LETTERHEAD_LAYOUTS.innovarehp, '')
}

/** One site's report as a letterheaded PDF, with whatever takeaways are saved for the range. */
export async function downloadReportPdf(
  siteKey: string,
  start: string,
  end: string,
): Promise<Result<ReportFile>> {
  const check = await checked(siteKey, start, end)
  if (!check.ok) return check
  try {
    return {
      ok: true,
      data: {
        fileName: reportFileName(check.site, start, end),
        bytes: await letterheadedReport(check.organizationId, check.site, check.range),
      },
    }
  } catch (error) {
    return readFailure(check.site, error)
  }
}

export interface ReportZip extends ReportFile {
  /** Sites left out because their report could not be read, with the reason. */
  failed: { site: string; message: string }[]
}

/** Every report site's PDF for one range in a single zip; a site that fails is named, not fatal. */
export async function downloadAllReports(start: string, end: string): Promise<Result<ReportZip>> {
  const check = await checkedRange(start, end)
  if (!check.ok) return check

  const files: Record<string, Uint8Array> = {}
  const failed: ReportZip['failed'] = []
  // One at a time: GA4 rations requests per property, and 14 letterheads at once is a lot of memory.
  for (const site of REPORT_SITES) {
    try {
      files[reportFileName(site, start, end)] = await letterheadedReport(
        check.organizationId,
        site,
        check.range,
      )
    } catch (error) {
      const failure = readFailure(site, error)
      failed.push({ site: site.name, message: failure.message })
    }
  }
  if (Object.keys(files).length === 0) {
    return { ok: false, message: failed[0]?.message ?? 'No report could be built.' }
  }

  // PDFs are already compressed, so the zip only stores them.
  const bytes = zipSync(files, { level: 0 })
  return { ok: true, data: { fileName: `Website Reports - ${start} to ${end}.zip`, bytes, failed } }
}
