import { daysIn, previousRange, shiftDay, type DayRange } from './days'
import { REPORT_SITES, type ReportSite } from './sites'

export const RANGE_PRESETS = ['report-month', '7d', '30d', '60d', 'last-month', 'custom'] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

// Netlify's daily totals reach back to here, and GA4 tagging started later still.
export const FIRST_REPORT_DAY = '2026-09-01'
// A year is the longest stretch the charts stay readable at one point per day.
export const MAX_RANGE_DAYS = 366

export type FixedPreset = Exclude<RangePreset, 'custom'>

export const PRESET_LABELS: Record<RangePreset, string> = {
  'report-month': 'Report month',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '60d': 'Last 60 days',
  'last-month': 'Last month',
  custom: 'Custom',
}

const PRESET_DAYS = { '7d': 7, '30d': 30, '60d': 60 } as const
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export interface ReportView {
  site: ReportSite
  preset: RangePreset
  range: DayRange
  previous: DayRange
}

export interface ReportParams {
  site: string | null
  range: string | null
  from: string | null
  to: string | null
}

function isDayKey(value: string | null): value is string {
  return Boolean(value && DAY_KEY.test(value) && shiftDay(value, 0) === value)
}

/** The whole days a preset covers, ending yesterday at the latest because today is still being counted. */
export function presetRange(preset: FixedPreset, today: string): DayRange {
  if (preset === 'report-month') {
    // Client reports run the 25th to the 24th, so the latest finished one ends on the last 24th.
    const thisMonth24 = `${today.slice(0, 7)}-24`
    const lastMonth = shiftDay(`${today.slice(0, 7)}-01`, -1).slice(0, 7)
    const end = today > thisMonth24 ? thisMonth24 : `${lastMonth}-24`
    return { start: `${shiftDay(`${end.slice(0, 7)}-01`, -1).slice(0, 7)}-25`, end }
  }
  if (preset === 'last-month') {
    const end = shiftDay(`${today.slice(0, 7)}-01`, -1)
    return { start: `${end.slice(0, 7)}-01`, end }
  }
  return { start: shiftDay(today, -PRESET_DAYS[preset]), end: shiftDay(today, -1) }
}

function isFixedPreset(value: string | null): value is FixedPreset {
  return value !== 'custom' && (RANGE_PRESETS as readonly (string | null)[]).includes(value)
}

/** Why a custom range cannot be shown, or null when it can. */
export function customRangeProblem(range: DayRange, today: string): string | null {
  if (range.start > range.end) return 'The start date is after the end date.'
  if (range.start < FIRST_REPORT_DAY) return 'Reports start on Sep 1, 2026.'
  if (range.end >= today) return 'Pick days up to yesterday; today is still being counted.'
  if (daysIn(range) > MAX_RANGE_DAYS) return 'Pick a range of a year or less.'
  return null
}

/** Reads the address bar, falling back to the first site and the last 30 days for anything off. */
export function reportViewOf(params: ReportParams, today: string): ReportView {
  const site =
    REPORT_SITES.find((one) => one.key === params.site) ?? (REPORT_SITES[0] as ReportSite)

  let preset: RangePreset = isFixedPreset(params.range) ? params.range : '30d'
  let range = presetRange(preset, today)
  if (params.range === 'custom' && isDayKey(params.from) && isDayKey(params.to)) {
    const custom = { start: params.from, end: params.to }
    if (!customRangeProblem(custom, today)) {
      preset = 'custom'
      range = custom
    }
  }

  return { site, preset, range, previous: previousRange(range) }
}

/** The query string for a view; the defaults are left out so the plain tab link stays short. */
export function reportQueryOf(view: {
  siteKey: string
  preset: RangePreset
  range?: DayRange
}): URLSearchParams {
  const query = new URLSearchParams({ tab: 'analytics', site: view.siteKey })
  if (view.preset === 'custom' && view.range) {
    query.set('range', 'custom')
    query.set('from', view.range.start)
    query.set('to', view.range.end)
  } else if (view.preset !== '30d' && view.preset !== 'custom') {
    query.set('range', view.preset)
  }
  return query
}

const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** A range as people read it, such as "Oct 1 – 31, 2026". */
export function rangeLabel(range: DayRange): string {
  // Intl pads the dash with thin spaces, which find-in-page and screen readers trip over.
  return dayLabel.formatRange(Date.parse(range.start), Date.parse(range.end)).replace(/\s/g, ' ')
}
