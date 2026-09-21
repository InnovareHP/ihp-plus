const absolute = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })

const STEPS = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
] as const satisfies readonly { unit: Intl.RelativeTimeFormatUnit; ms: number }[]

/** "2 days ago" — the hint beside the date, never the date itself. */
export function relativeTo(iso: string, now: Date = new Date()) {
  const elapsed = new Date(iso).getTime() - now.getTime()

  for (const step of STEPS) {
    if (Math.abs(elapsed) >= step.ms) {
      return relative.format(Math.round(elapsed / step.ms), step.unit)
    }
  }
  return 'just now'
}

/** The house format for a moment: absolute, with the relative hint after it. */
export function describeMoment(iso: string, now: Date = new Date()) {
  return `${absolute.format(new Date(iso))} · ${relativeTo(iso, now)}`
}
