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

/** The zones a picker offers, with the reader's own guaranteed to be among them. */
export function timeZoneOptions(current: string) {
  const known =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [current]
  return known.includes(current) ? known : [current, ...known]
}
