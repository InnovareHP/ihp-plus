/** Sunday first, because getDay() counts that way and the stored list mirrors it. */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const DEFAULT_WORKDAYS = '1,2,3,4,5'

export function parseWorkdays(value: string): number[] {
  const days = value
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  return [...new Set(days)].sort((a, b) => a - b)
}

export function formatWorkdays(value: string): string {
  const days = parseWorkdays(value)
  if (days.length === 0) return 'No set days'
  return days.map((day) => WEEKDAY_LABELS[day]).join(', ')
}

/** Minutes past midnight as the input shows them: 540 reads 09:00. */
export function minutesToClock(minutes: number): string {
  const safe = Math.min(Math.max(Math.round(minutes), 0), 24 * 60 - 1)
  const hours = Math.floor(safe / 60)
  return `${String(hours).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function clockToMinutes(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return undefined

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return undefined
  return hours * 60 + minutes
}

export function formatHours(seconds: number): string {
  const safe = Math.max(Math.floor(seconds), 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

/** A running clock reads as a clock, not as "1h 2m" jumping a minute at a time. */
export function formatElapsed(seconds: number): string {
  const safe = Math.max(Math.floor(seconds), 0)
  const parts = [Math.floor(safe / 3600), Math.floor((safe % 3600) / 60), safe % 60]
  return parts.map((part) => String(part).padStart(2, '0')).join(':')
}

// en-CA formats as YYYY-MM-DD, which is the key every range query and URL uses.
const dateKeyFormat = new Map<string, Intl.DateTimeFormat>()

function dateKeyFormatter(timeZone: string) {
  const cached = dateKeyFormat.get(timeZone)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' })
  dateKeyFormat.set(timeZone, formatter)
  return formatter
}

/** The working day an instant belongs to, counted in the organization's zone. */
export function workDateKey(at: Date, timeZone: string): string {
  return dateKeyFormatter(timeZone).format(at)
}

const clockFormat = new Map<string, Intl.DateTimeFormat>()

function clockFormatter(timeZone: string) {
  const cached = clockFormat.get(timeZone)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  clockFormat.set(timeZone, formatter)
  return formatter
}

/** Minutes past midnight in the organization's zone, which is what a shift is stored as. */
export function minutesOfDay(at: Date, timeZone: string): number {
  const parsed = clockToMinutes(clockFormatter(timeZone).format(at))
  return parsed ?? 0
}

export function lateSecondsFor(input: {
  clockInAt: Date
  shiftStartMinutes: number
  graceMinutes: number
  timeZone: string
}): number {
  const arrived = minutesOfDay(input.clockInAt, input.timeZone)
  const allowed = input.shiftStartMinutes + input.graceMinutes
  return arrived <= allowed ? 0 : (arrived - input.shiftStartMinutes) * 60
}

/** Paid time is the span minus the breaks inside it, never negative. */
export function workedSecondsFor(clockInAt: Date, clockOutAt: Date, breakSeconds: number): number {
  const span = Math.floor((clockOutAt.getTime() - clockInAt.getTime()) / 1000)
  return Math.max(span - Math.max(breakSeconds, 0), 0)
}

export function isWorkday(dateKey: string, workdays: string): boolean {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay()
  return parseWorkdays(workdays).includes(day)
}

/** Shifts the YYYY-MM-DD key by whole days without dragging a zone into it. */
export function shiftDateKey(dateKey: string, days: number): string {
  const at = new Date(`${dateKey}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}
