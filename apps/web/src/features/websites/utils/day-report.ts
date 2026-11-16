import { shiftDateKey, zonedInstant } from '@ihp/clock'
import {
  AUTOMATIC_CHECKER_NAME,
  CHECK_ROUNDS,
  CHECK_ROUND_LABELS,
  type CheckRound,
  type CheckStatus,
  type Checklist,
  type ManualResult,
  type WebsiteRow,
} from '../schema'
import { daysUntil } from './domain'
import { isOverridden, type ProbeReading } from './verdict'

// The night shift the website day is built around (see work-day.ts).
export const SHIFT_START = '20:00'
export const SHIFT_END = '04:00'

export interface ReportRound {
  status: CheckStatus
  time: string
  reading: string
  note: string
  checkedBy: string
  /** The lead changed what the checker decided. */
  overridden: boolean
}

export interface ReportExpiry {
  /** Formatted date, or undefined when the registry or site did not say. */
  at: string | undefined
  days: number | undefined
}

export interface ReportSite {
  name: string
  url: string
  client: string
  rounds: Partial<Record<CheckRound, ReportRound>>
  pagesButtons: ManualResult | undefined
  formEmail: { result: ManualResult; testedOn: string } | undefined
  findings: string
  action: string
  domain: ReportExpiry
  ssl: ReportExpiry
}

export interface ReportProblem {
  website: string
  fixed: boolean
}

export interface ManualSummary {
  pagesPass: number
  pagesFail: number
  pagesUnchecked: number
  formTested: number
  formFailed: number
}

/** ISO expiry dates per site id, read live when the report is made. */
export type ExpiryById = Map<string, { domain: string | undefined; ssl: string | undefined }>

export type RoundCounts = Record<CheckStatus | 'unchecked', number>

export interface DayReport {
  date: string
  dateLabel: string
  zoneLabel: string
  shiftStart: string
  shiftEnd: string
  shiftHours: string
  itLead: string
  roundTimes: Record<CheckRound, string>
  summary: Record<CheckRound, RoundCounts>
  sites: ReportSite[]
  problems: ReportProblem[]
  manual: ManualSummary
  /** False when the lookups were not run, so the PDF leaves the section out. */
  hasExpiry: boolean
  preparedBy: string
  generatedAt: string
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatDateKey(dateKey: string) {
  return dateFormat.format(new Date(`${dateKey}T00:00:00.000Z`))
}

// A supervisor reads 8:00 PM, not the 24-hour clock the checklist cards use.
export function formatTime(at: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(
    typeof at === 'string' ? new Date(at) : at,
  )
}

export function formatDate(at: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(typeof at === 'string' ? new Date(at) : at)
}

export function formatInstant(at: Date | string, timeZone: string) {
  return `${formatDate(at, timeZone)} · ${formatTime(at, timeZone)}`
}

function zoneName(at: Date, timeZone: string, style: 'long' | 'shortOffset') {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: style }).formatToParts(
    at,
  )
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone
}

// Short enough to fit a narrow table column on one line: "200 · 310 ms".
export function compactReading(reading: ProbeReading) {
  if (reading.error) return reading.error
  if (reading.httpStatus === undefined) return 'No answer'
  return reading.responseMs === undefined
    ? String(reading.httpStatus)
    : `${reading.httpStatus} · ${reading.responseMs} ms`
}

function hasProblem(website: WebsiteRow) {
  return (
    CHECK_ROUNDS.some((round) => {
      const status = website.checks[round]?.status
      return status === 'issue' || status === 'down'
    }) ||
    website.shift.pagesButtons === 'fail' ||
    website.formEmail?.result === 'fail'
  )
}

// Fixed means the shift ended with the site running and nothing the lead tested still failing.
function isFixed(website: WebsiteRow) {
  return (
    website.checks.clock_out?.status === 'up' &&
    website.shift.pagesButtons !== 'fail' &&
    website.formEmail?.result !== 'fail'
  )
}

function expiryOf(at: string | undefined, timeZone: string, now: Date): ReportExpiry {
  return at
    ? { at: formatDate(at, timeZone), days: daysUntil(at, now) }
    : { at: undefined, days: undefined }
}

export function buildDayReport({
  checklist,
  preparedBy,
  generatedAt,
  expiries,
}: {
  checklist: Checklist
  preparedBy: string
  generatedAt: Date
  expiries?: ExpiryById
}): DayReport {
  const { date, timeZone } = checklist
  const start = zonedInstant(date, SHIFT_START, timeZone) ?? new Date(`${date}T00:00:00.000Z`)
  const end = zonedInstant(shiftDateKey(date, 1), SHIFT_END, timeZone) ?? start

  const sites: ReportSite[] = checklist.websites.map((website) => {
    const rounds: ReportSite['rounds'] = {}
    for (const round of CHECK_ROUNDS) {
      const check = website.checks[round]
      if (!check) continue
      rounds[round] = {
        status: check.status,
        time: formatTime(check.checkedAt, timeZone),
        reading: compactReading(check),
        note: check.note,
        checkedBy: check.checkedByName,
        // Only a person can override; an automatic run's status is the checker's by definition.
        overridden: check.checkedByName !== AUTOMATIC_CHECKER_NAME && isOverridden(check),
      }
    }
    const expiry = expiries?.get(website.id)
    return {
      name: website.name,
      url: website.url,
      client: website.clientName,
      rounds,
      pagesButtons: website.shift.pagesButtons,
      formEmail: website.formEmail
        ? {
            result: website.formEmail.result,
            testedOn: new Intl.DateTimeFormat('en-US', {
              timeZone,
              month: 'short',
              day: 'numeric',
            }).format(new Date(website.formEmail.testedAt)),
          }
        : undefined,
      findings: website.shift.findings,
      action: website.shift.action,
      domain: expiryOf(expiry?.domain, timeZone, generatedAt),
      ssl: expiryOf(expiry?.ssl, timeZone, generatedAt),
    }
  })

  const summary = {} as Record<CheckRound, RoundCounts>
  const roundTimes = {} as Record<CheckRound, string>
  for (const round of CHECK_ROUNDS) {
    const counts: RoundCounts = { up: 0, issue: 0, down: 0, unchecked: 0 }
    for (const site of sites) counts[site.rounds[round]?.status ?? 'unchecked'] += 1
    summary[round] = counts

    const times = checklist.websites
      .map((website) => website.checks[round]?.checkedAt)
      .filter((at): at is string => Boolean(at))
      .sort()
    roundTimes[round] = times[0] ? formatTime(times[0], timeZone) : 'Not run'
  }

  const problems = checklist.websites
    .filter(hasProblem)
    .map((website) => ({ website: website.name, fixed: isFixed(website) }))

  const manual: ManualSummary = {
    pagesPass: sites.filter((site) => site.pagesButtons === 'pass').length,
    pagesFail: sites.filter((site) => site.pagesButtons === 'fail').length,
    pagesUnchecked: sites.filter((site) => !site.pagesButtons).length,
    formTested: sites.filter((site) => site.formEmail).length,
    formFailed: sites.filter((site) => site.formEmail?.result === 'fail').length,
  }

  // The lead is whoever marked sites by hand; an all-automatic shift falls back to the exporter.
  const itLead =
    checklist.websites
      .flatMap((website) => CHECK_ROUNDS.map((round) => website.checks[round]?.checkedByName))
      .find((name) => name && name !== AUTOMATIC_CHECKER_NAME) ?? preparedBy

  return {
    date,
    dateLabel: formatDateKey(date),
    zoneLabel: `${zoneName(start, timeZone, 'long')} (${zoneName(start, timeZone, 'shortOffset')})`,
    shiftStart: formatInstant(start, timeZone),
    shiftEnd: formatInstant(end, timeZone),
    shiftHours: `${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}`,
    itLead,
    roundTimes,
    summary,
    sites,
    problems,
    manual,
    hasExpiry: Boolean(expiries),
    preparedBy,
    generatedAt: formatInstant(generatedAt, timeZone),
  }
}

export function dayReportFileName(date: string) {
  return `Daily-Website-Check-${date}.pdf`
}

export const ROUND_HEADINGS: Record<CheckRound, string> = {
  clock_in: `${CHECK_ROUND_LABELS.clock_in} (shift start)`,
  clock_out: `${CHECK_ROUND_LABELS.clock_out} (shift end)`,
}
