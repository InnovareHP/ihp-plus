import { formatTimeOfDay, shiftDateKey, workDateKey } from '@ihp/clock'

const SUGGESTION_RANGE_DAYS = 14

/** Whether the runtime knows the zone; a bad name would otherwise throw inside Intl. */
export function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** "Tue, Oct 14, 10:00 AM (Asia/Manila)": the zone is named so nobody converts in their head. */
export function formatInterviewTime(iso: string, timeZone: string) {
  const when = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
  return `${when} (${timeZone})`
}

/** The two weeks from today, in the organization's zone, that free times are read across. */
export function suggestionWindow(timeZone: string, now = new Date()) {
  const fromDate = workDateKey(now, timeZone)
  return { fromDate, toDate: shiftDateKey(fromDate, SUGGESTION_RANGE_DAYS) }
}

/** An instant as the wall-clock day and time the offer form's rows hold. */
export function slotOf(iso: string, timeZone: string) {
  const at = new Date(iso)
  return { date: workDateKey(at, timeZone), time: formatTimeOfDay(at, timeZone) }
}

/** The earliest free time on each of the first `count` days, so the offer spreads out. */
export function spreadAcrossDays(starts: readonly string[], timeZone: string, count: number) {
  const days = new Map<string, { date: string; time: string }>()
  for (const start of [...starts].sort()) {
    const slot = slotOf(start, timeZone)
    if (!days.has(slot.date)) days.set(slot.date, slot)
    if (days.size === count) break
  }
  return [...days.values()]
}

/** The zones a picker offers, with the reader's own guaranteed to be among them. */
export function timeZoneOptions(current: string) {
  const known =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [current]
  return known.includes(current) ? known : [current, ...known]
}
