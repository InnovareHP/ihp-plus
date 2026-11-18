const DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** A YYYY-MM-DD send day, read as the calendar date it names rather than an instant. */
export function formatSendOn(dateKey: string) {
  return DAY.format(new Date(`${dateKey}T00:00:00.000Z`))
}
