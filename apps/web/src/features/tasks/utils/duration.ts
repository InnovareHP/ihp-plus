// People type hours the way they say them — "1h 30m", "90m", "1.5h", "2" — so the field takes
// all of it rather than making them count minutes.
const DURATION_PATTERN = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?$/i

/** Seconds, or undefined when the text is not a duration at all. */
export function parseDuration(input: string): number | undefined {
  const text = input.trim().toLowerCase()
  if (!text) return undefined

  // A bare number is hours: "2" is two hours, the way a timesheet is read aloud.
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 3600)

  const match = DURATION_PATTERN.exec(text)
  if (!match) return undefined

  const hours = match[1] ? Number(match[1]) : 0
  const minutes = match[2] ? Number(match[2]) : 0
  if (hours === 0 && minutes === 0) return undefined

  return Math.round(hours * 3600 + minutes * 60)
}

/** "3h 20m", "45m", "0m" — never a bare number of seconds, which nobody reads as time. */
export function formatDuration(seconds: number): string {
  const safe = Math.max(Math.round(seconds), 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.round((safe % 3600) / 60)

  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

/** The running total of a timer started at `startedAt`, in seconds. */
export function elapsedSince(startedAt: string, now = new Date()): number {
  return Math.max(Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000), 0)
}

/** "0:04:12" — a ticking clock reads as a clock, not as a rounded duration. */
export function formatClock(seconds: number): string {
  const safe = Math.max(Math.round(seconds), 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const rest = safe % 60

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
