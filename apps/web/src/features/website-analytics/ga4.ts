import { daysIn, previousRange, shiftDay, type DayRange } from './days'
import { analyticsToken } from './google-auth'
import type { ReportSite } from './sites'

const API = 'https://analyticsdata.googleapis.com/v1beta'
const TOP = 5
// Search Console rows come per landing page only, so the totals are summed from enough of them.
const SEO_ROWS = 250
const ORGANIC = 'Organic Search'

export class Ga4Error extends Error {}

export interface Ga4Totals {
  sessions: number
  totalUsers: number
  newUsers: number
  pageViews: number
  avgSessionSeconds: number
  engagementRate: number
  organicSearchVisits: number
  /** Null when the site tracks no call or email clicks, so the tile is left out. */
  callsAndEmails: number | null
}

export interface Ga4Row {
  label: string
  sessions: number
  engagementRate: number
}

export interface Ga4SeoPage {
  page: string
  clicks: number
  impressions: number
  position: number
}

export interface Ga4Seo {
  clicks: number
  impressions: number
  clickThroughRate: number
  averagePosition: number
  pages: Ga4SeoPage[]
}

export interface Ga4Report {
  range: DayRange
  previous: DayRange
  /** GA4 counts days in the property's own zone, which the report notes. */
  timeZone: string
  totals: Ga4Totals
  previousTotals: Ga4Totals
  sessionsByDay: { day: string; sessions: number; previousSessions: number }[]
  channels: { channel: string; sessions: number }[]
  landingPages: Ga4Row[]
  sources: Ga4Row[]
  /** Null when Search Console is not linked or has no rows for the range. */
  seo: Ga4Seo | null
}

interface ReportRequest {
  dateRanges: { startDate: string; endDate: string; name: string }[]
  dimensions?: { name: string }[]
  metrics: { name: string }[]
  dimensionFilter?: unknown
  orderBys?: unknown[]
  limit?: number
}

interface ReportResponse {
  dimensionHeaders?: { name?: string }[]
  metricHeaders?: { name?: string }[]
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[]
  metadata?: { timeZone?: string }
}

interface Row {
  dims: Record<string, string>
  metrics: Record<string, number>
}

function rowsOf(report: ReportResponse | undefined): Row[] {
  const dimNames = (report?.dimensionHeaders ?? []).map((header) => header.name ?? '')
  const metricNames = (report?.metricHeaders ?? []).map((header) => header.name ?? '')
  return (report?.rows ?? []).map((row) => ({
    dims: Object.fromEntries(
      dimNames.map((name, index) => [name, row.dimensionValues?.[index]?.value ?? '']),
    ),
    metrics: Object.fromEntries(
      metricNames.map((name, index) => [name, Number(row.metricValues?.[index]?.value) || 0]),
    ),
  }))
}

async function batch(propertyId: string, requests: ReportRequest[]): Promise<ReportResponse[]> {
  if (requests.length === 0) return []
  const token = await analyticsToken()
  const response = await fetch(`${API}/properties/${propertyId}:batchRunReports`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ requests }),
    cache: 'no-store',
  })
  const body = (await response.json().catch(() => ({}))) as {
    reports?: ReportResponse[]
    error?: { message?: string }
  }
  if (!response.ok) {
    throw new Ga4Error(
      response.status === 403
        ? `The service account cannot read GA4 property ${propertyId}.`
        : `GA4 answered ${response.status}: ${body.error?.message ?? 'no detail'}`,
    )
  }
  return body.reports ?? []
}

const bySessions = [{ metric: { metricName: 'sessions' }, desc: true }]

function topRows(rows: Row[], dimension: string): Ga4Row[] {
  return rows.slice(0, TOP).map((row) => ({
    label: row.dims[dimension] ?? '',
    sessions: row.metrics.sessions ?? 0,
    engagementRate: row.metrics.engagementRate ?? 0,
  }))
}

function seoOf(rows: Row[]): Ga4Seo | null {
  const pages = rows
    .map((row) => ({
      page: row.dims.landingPagePlusQueryString ?? '',
      clicks: row.metrics.organicGoogleSearchClicks ?? 0,
      impressions: row.metrics.organicGoogleSearchImpressions ?? 0,
      position: row.metrics.organicGoogleSearchAveragePosition ?? 0,
    }))
    .filter((page) => page.impressions > 0)
  if (pages.length === 0) return null

  const clicks = pages.reduce((sum, page) => sum + page.clicks, 0)
  const impressions = pages.reduce((sum, page) => sum + page.impressions, 0)
  // Each page's position counts as often as Google showed it, as Search Console weighs it.
  const weighted = pages.reduce((sum, page) => sum + page.position * page.impressions, 0)
  return {
    clicks,
    impressions,
    clickThroughRate: clicks / impressions,
    averagePosition: weighted / impressions,
    pages: [...pages]
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, TOP),
  }
}

/** One site's report for a range against the same number of days before it, in two GA4 calls. */
export async function readGa4Report(site: ReportSite, range: DayRange): Promise<Ga4Report> {
  if (site.source !== 'ga4') throw new Ga4Error(`${site.name} is not a GA4 site.`)
  if (range.start > range.end) throw new Ga4Error('The range ends before it starts.')

  const previous = previousRange(range)
  const both = [
    { startDate: range.start, endDate: range.end, name: 'current' },
    { startDate: previous.start, endDate: previous.end, name: 'previous' },
  ]
  const current = both.slice(0, 1)

  const [totals, channels, days, landing, sources] = await batch(site.sourceId, [
    {
      dateRanges: both,
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'engagementRate' },
      ],
    },
    {
      dateRanges: both,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: bySessions,
    },
    { dateRanges: both, dimensions: [{ name: 'nthDay' }], metrics: [{ name: 'sessions' }] },
    {
      dateRanges: current,
      dimensions: [{ name: 'landingPage' }],
      metrics: [{ name: 'sessions' }, { name: 'engagementRate' }],
      orderBys: bySessions,
      limit: TOP,
    },
    {
      dateRanges: current,
      dimensions: [{ name: 'sessionSourceMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'engagementRate' }],
      orderBys: bySessions,
      limit: TOP,
    },
  ])

  const extra: ReportRequest[] = []
  if (site.callEvents.length > 0) {
    extra.push({
      dateRanges: both,
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: { fieldName: 'eventName', inListFilter: { values: [...site.callEvents] } },
      },
    })
  }
  if (site.seo) {
    extra.push({
      dateRanges: current,
      dimensions: [{ name: 'landingPagePlusQueryString' }],
      metrics: [
        { name: 'organicGoogleSearchClicks' },
        { name: 'organicGoogleSearchImpressions' },
        { name: 'organicGoogleSearchAveragePosition' },
      ],
      orderBys: [{ metric: { metricName: 'organicGoogleSearchClicks' }, desc: true }],
      limit: SEO_ROWS,
    })
  }
  const extraReports = await batch(site.sourceId, extra)
  const calls = site.callEvents.length > 0 ? extraReports[0] : undefined
  const seo = site.seo ? extraReports[extraReports.length - 1] : undefined

  // With two ranges GA4 tags each row with the range's name; with one it adds no such column.
  const inRange = (row: Row, name: string) => (row.dims.dateRange ?? 'current') === name
  const channelRows = rowsOf(channels)
  const callRows = rowsOf(calls)

  function totalsFor(name: string): Ga4Totals {
    const row = rowsOf(totals).find((one) => inRange(one, name))
    const metric = (key: string) => row?.metrics[key] ?? 0
    return {
      sessions: metric('sessions'),
      totalUsers: metric('totalUsers'),
      newUsers: metric('newUsers'),
      pageViews: metric('screenPageViews'),
      avgSessionSeconds: metric('averageSessionDuration'),
      engagementRate: metric('engagementRate'),
      organicSearchVisits:
        channelRows.find(
          (one) => inRange(one, name) && one.dims.sessionDefaultChannelGroup === ORGANIC,
        )?.metrics.sessions ?? 0,
      callsAndEmails: calls
        ? callRows
            .filter((one) => inRange(one, name))
            .reduce((sum, one) => sum + (one.metrics.eventCount ?? 0), 0)
        : null,
    }
  }

  const length = daysIn(range)
  const dayCounts = {
    current: new Array<number>(length).fill(0),
    previous: new Array<number>(length).fill(0),
  }
  for (const row of rowsOf(days)) {
    const index = Number(row.dims.nthDay)
    const series = inRange(row, 'previous') ? dayCounts.previous : dayCounts.current
    if (Number.isInteger(index) && index >= 0 && index < length) {
      series[index] = row.metrics.sessions ?? 0
    }
  }

  return {
    range,
    previous,
    timeZone: totals?.metadata?.timeZone ?? '',
    totals: totalsFor('current'),
    previousTotals: totalsFor('previous'),
    sessionsByDay: dayCounts.current.map((sessions, index) => ({
      day: shiftDay(range.start, index),
      sessions,
      previousSessions: dayCounts.previous[index] ?? 0,
    })),
    channels: channelRows
      .filter((row) => inRange(row, 'current'))
      .map((row) => ({
        channel: row.dims.sessionDefaultChannelGroup ?? '',
        sessions: row.metrics.sessions ?? 0,
      })),
    landingPages: topRows(rowsOf(landing), 'landingPage'),
    sources: topRows(rowsOf(sources), 'sessionSourceMedium'),
    seo: seo ? seoOf(rowsOf(seo)) : null,
  }
}
