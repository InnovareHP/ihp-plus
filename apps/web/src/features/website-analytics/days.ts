export const DAY_MS = 86_400_000

const dayKeyFormats = new Map<string, Intl.DateTimeFormat>()

/** The calendar day an instant falls on in a time zone, as YYYY-MM-DD. */
export function dayKeyOf(instant: Date, timeZone: string): string {
  let format = dayKeyFormats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    dayKeyFormats.set(timeZone, format)
  }
  return format.format(instant)
}

export function shiftDay(dayKey: string, days: number): string {
  const [year = 0, month = 1, day = 1] = dayKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function offsetMinutesAt(instant: Date, timeZone: string): number {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(instant)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name)
  if (!match) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return match[1] === '-' ? -minutes : minutes
}

/** The offset Netlify's analytics expect, such as -0500. */
export function offsetOf(instant: Date, timeZone: string): string {
  const minutes = offsetMinutesAt(instant, timeZone)
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const hours = String(Math.floor(abs / 60)).padStart(2, '0')
  return `${sign}${hours}${String(abs % 60).padStart(2, '0')}`
}

/** Local midnight of a day, as an instant. */
export function dayStart(dayKey: string, timeZone: string): Date {
  const utcMidnight = Date.parse(`${dayKey}T00:00:00.000Z`)
  const first = utcMidnight - offsetMinutesAt(new Date(utcMidnight), timeZone) * 60_000
  // Read the offset again at the answer, since a clock change can sit between the two.
  return new Date(utcMidnight - offsetMinutesAt(new Date(first), timeZone) * 60_000)
}

/** The `count` whole days before today in that zone, oldest first. */
export function lastDays(count: number, now: Date, timeZone: string): string[] {
  const today = dayKeyOf(now, timeZone)
  return Array.from({ length: count }, (_, index) => shiftDay(today, index - count))
}
