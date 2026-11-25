import { daysIn, shiftDay, type DayRange } from './days'
import type { Ranked } from './netlify'

const TOP = 10

/** One saved day as the report reads it, with bandwidth already a plain number. */
export interface SavedDay {
  day: string
  pageviews: number
  visitors: number
  bandwidthBytes: number
  sources: unknown
  pages: unknown
  countries: unknown
}

export interface NetlifyTotals {
  pageviews: number
  /** Daily visitors added up, over the days Netlify still had them when they were saved. */
  visitors: number
  bandwidthBytes: number
}

export interface NetlifyCoverage {
  days: number
  /** Days with a saved row at all. */
  savedDays: number
  visitorDays: number
  rankingDays: number
}

export interface NetlifyRow {
  label: string
  count: number
}

export interface NetlifyReport {
  range: DayRange
  previous: DayRange
  totals: NetlifyTotals
  previousTotals: NetlifyTotals
  coverage: NetlifyCoverage
  previousCoverage: NetlifyCoverage
  days: { day: string; pageviews: number; previousPageviews: number }[]
  busiest: { day: string; pageviews: number } | null
  sources: NetlifyRow[]
  pages: NetlifyRow[]
  countries: NetlifyRow[]
}

function rankedOf(value: unknown): Ranked[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    const { resource, count, label } = (row ?? {}) as Record<string, unknown>
    return typeof resource === 'string' && typeof count === 'number'
      ? [{ resource, count, ...(typeof label === 'string' ? { label } : {}) }]
      : []
  })
}

// A busy day saved with no visitors is one Netlify had already forgotten, not a quiet day.
const hasVisitors = (day: SavedDay) => day.visitors > 0 || day.pageviews === 0
const hasRankings = (day: SavedDay) =>
  day.pageviews === 0 || rankedOf(day.pages).length > 0 || rankedOf(day.sources).length > 0

function totalsOf(days: SavedDay[]): NetlifyTotals {
  return days.reduce(
    (sum, day) => ({
      pageviews: sum.pageviews + day.pageviews,
      visitors: sum.visitors + (hasVisitors(day) ? day.visitors : 0),
      bandwidthBytes: sum.bandwidthBytes + day.bandwidthBytes,
    }),
    { pageviews: 0, visitors: 0, bandwidthBytes: 0 },
  )
}

function coverageOf(days: SavedDay[], range: DayRange): NetlifyCoverage {
  return {
    days: daysIn(range),
    savedDays: days.length,
    visitorDays: days.filter(hasVisitors).length,
    rankingDays: days.filter(hasRankings).length,
  }
}

/** Adds each day's top list into one for the range, since Netlify only ranks a day at a time. */
function merge(
  days: SavedDay[],
  key: 'sources' | 'pages' | 'countries',
  name: (row: Ranked) => string,
) {
  const counts = new Map<string, number>()
  for (const day of days) {
    for (const row of rankedOf(day[key])) {
      const label = name(row)
      counts.set(label, (counts.get(label) ?? 0) + row.count)
    }
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, TOP)
}

const inRange = (range: DayRange) => (day: SavedDay) =>
  day.day >= range.start && day.day <= range.end

/** The report for one Netlify site from its saved days, against the same number of days before. */
export function buildNetlifyReport(
  saved: SavedDay[],
  range: DayRange,
  previous: DayRange,
): NetlifyReport {
  const current = saved.filter(inRange(range))
  const before = saved.filter(inRange(previous))
  const viewsOn = new Map(saved.map((day) => [day.day, day.pageviews]))

  const days = Array.from({ length: daysIn(range) }, (_, index) => ({
    day: shiftDay(range.start, index),
    pageviews: viewsOn.get(shiftDay(range.start, index)) ?? 0,
    previousPageviews: viewsOn.get(shiftDay(previous.start, index)) ?? 0,
  }))
  const busiest = current.reduce<SavedDay | null>(
    (top, day) => (day.pageviews > (top?.pageviews ?? 0) ? day : top),
    null,
  )

  return {
    range,
    previous,
    totals: totalsOf(current),
    previousTotals: totalsOf(before),
    coverage: coverageOf(current, range),
    previousCoverage: coverageOf(before, previous),
    days,
    busiest: busiest ? { day: busiest.day, pageviews: busiest.pageviews } : null,
    // An empty referrer is someone who typed the address or used a bookmark.
    sources: merge(current, 'sources', (row) => row.resource || 'Direct'),
    pages: merge(current, 'pages', (row) => row.resource),
    countries: merge(current, 'countries', (row) => row.label ?? row.resource),
  }
}
