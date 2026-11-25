import { DAY_MS, dayKeyOf, dayStart, offsetOf, shiftDay } from './days'

// Netlify's own dashboard calls this API; it is undocumented, so every shape is checked on arrival.
const BASE = 'https://analytics.services.netlify.com/v2'
const RANKING_LIMIT = 50

// A type alias, not an interface, so Prisma accepts it as a JSON value.
export type Ranked = {
  resource: string
  count: number
  /** Netlify's readable name, such as "United States" for US. */
  label?: string
}

export interface NetlifyDayTotals {
  day: string
  pageviews: number
  visitors: number
  bandwidthBytes: number
}

export interface NetlifyDayRankings {
  sources: Ranked[]
  pages: Ranked[]
  countries: Ranked[]
}

export class NetlifyError extends Error {}

interface Range {
  from: number
  to: number
  timezone: string
}

function rangeOf(firstDay: string, lastDay: string, timeZone: string): Range {
  const from = dayStart(firstDay, timeZone).getTime()
  return {
    from,
    to: dayStart(shiftDay(lastDay, 1), timeZone).getTime(),
    timezone: offsetOf(new Date(from), timeZone),
  }
}

async function call(siteId: string, path: string, range: Range, extra = ''): Promise<unknown> {
  const token = process.env.NETLIFY_API_TOKEN
  if (!token) throw new NetlifyError('NETLIFY_API_TOKEN is not set.')

  const query = `from=${range.from}&to=${range.to}&timezone=${encodeURIComponent(range.timezone)}&resolution=day${extra}`
  const response = await fetch(`${BASE}/${siteId}/${path}?${query}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new NetlifyError(`Netlify answered ${response.status} for ${path}.`)
  }
  const body = (await response.json()) as { data?: unknown }
  if (!Array.isArray(body.data)) throw new NetlifyError(`Netlify sent no data for ${path}.`)
  return body.data
}

const isNumber = (value: unknown): value is number => typeof value === 'number'

// A bucket starts at Netlify's midnight; reading it at midday keeps a clock change from moving it a day.
const bucketDay = (start: number, timeZone: string) =>
  dayKeyOf(new Date(start + DAY_MS / 2), timeZone)

function series(data: unknown, timeZone: string): Map<string, number> {
  const days = new Map<string, number>()
  for (const point of data as unknown[]) {
    if (Array.isArray(point) && isNumber(point[0]) && isNumber(point[1])) {
      const day = bucketDay(point[0], timeZone)
      days.set(day, (days.get(day) ?? 0) + point[1])
    }
  }
  return days
}

function bandwidth(data: unknown, timeZone: string): Map<string, number> {
  const days = new Map<string, number>()
  for (const bucket of data as unknown[]) {
    const { start, siteBandwidth } = (bucket ?? {}) as { start?: unknown; siteBandwidth?: unknown }
    if (isNumber(start) && isNumber(siteBandwidth)) {
      const day = bucketDay(start, timeZone)
      days.set(day, (days.get(day) ?? 0) + siteBandwidth)
    }
  }
  return days
}

function ranking(data: unknown): Ranked[] {
  const rows: Ranked[] = []
  for (const row of data as unknown[]) {
    const { resource, count, country_name } = (row ?? {}) as Record<string, unknown>
    if (typeof resource === 'string' && isNumber(count)) {
      rows.push(
        typeof country_name === 'string'
          ? { resource, count, label: country_name }
          : { resource, count },
      )
    }
  }
  return rows
}

/** Pageviews, visitors and bandwidth for every day from first to last, in three calls. */
export async function readDailyTotals(
  siteId: string,
  firstDay: string,
  lastDay: string,
  timeZone: string,
): Promise<NetlifyDayTotals[]> {
  const range = rangeOf(firstDay, lastDay, timeZone)
  const [views, visitors, bytes] = await Promise.all([
    call(siteId, 'pageviews', range).then((data) => series(data, timeZone)),
    call(siteId, 'visitors', range).then((data) => series(data, timeZone)),
    call(siteId, 'bandwidth', range).then((data) => bandwidth(data, timeZone)),
  ])

  return [...views.keys()]
    .filter((day) => day >= firstDay && day <= lastDay)
    .sort()
    .map((day) => ({
      day,
      pageviews: views.get(day) ?? 0,
      visitors: visitors.get(day) ?? 0,
      bandwidthBytes: bytes.get(day) ?? 0,
    }))
}

/** One day's top sources, pages and countries; Netlify keeps these for 30 days only. */
export async function readDayRankings(
  siteId: string,
  day: string,
  timeZone: string,
): Promise<NetlifyDayRankings> {
  const range = rangeOf(day, day, timeZone)
  const limit = `&limit=${RANKING_LIMIT}`
  const [sources, pages, countries] = await Promise.all([
    call(siteId, 'ranking/sources', range, limit),
    call(siteId, 'ranking/pages', range, limit),
    call(siteId, 'ranking/countries', range, limit),
  ])
  return { sources: ranking(sources), pages: ranking(pages), countries: ranking(countries) }
}
