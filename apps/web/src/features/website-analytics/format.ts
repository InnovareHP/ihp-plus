const count = new Intl.NumberFormat('en-US')
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })
const change = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
})
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const shortDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export const formatCount = (value: number) => count.format(Math.round(value))

export const formatPercent = (ratio: number) => percent.format(ratio)

export const formatDecimal = (value: number) => decimal.format(value)

/** Time on site the way people say it, such as "1m 32s". */
export function formatDuration(seconds: number): string {
  // Rounded down, as Looker Studio shows it, so the two reports agree to the second.
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`
}

/** How far a number moved against the period before, or null when there is nothing to compare. */
export function changeOf(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / previous
}

export const formatChange = (ratio: number) => change.format(ratio).replace('-', '−')

/** A day key as a chart label, such as "Nov 3". */
export const formatShortDay = (dayKey: string) => shortDay.format(Date.parse(dayKey))
