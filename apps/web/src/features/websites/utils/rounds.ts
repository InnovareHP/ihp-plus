import type { CheckRound, WebsiteRow } from '../schema'

export function roundCounts(websites: readonly WebsiteRow[], round: CheckRound) {
  const statuses = websites.map((site) => site.checks[round]?.status)
  return {
    up: statuses.filter((status) => status === 'up').length,
    issue: statuses.filter((status) => status === 'issue').length,
    down: statuses.filter((status) => status === 'down').length,
    unchecked: statuses.filter((status) => status === undefined).length,
  }
}

/** How long after a punch the page keeps looking for the round the punch started. */
export const AUTO_ROUND_WINDOW_MS = 3 * 60 * 1000

/** The round a punch starts: clocked in means time in is due, clocked out means time out. */
export function roundForPunch(day: { isOpen: boolean } | undefined): CheckRound | undefined {
  if (!day) return undefined
  return day.isOpen ? 'clock_in' : 'clock_out'
}

/**
 * Whether the round a punch queued could still be landing: some sites unchecked, and the punch
 * recent enough that the background run has not had time to finish.
 */
export function awaitingAutoRound(
  websites: readonly WebsiteRow[],
  round: CheckRound | undefined,
  punchedAt: string | undefined,
  now: number,
) {
  if (!round || !punchedAt || websites.length === 0) return false
  if (now - Date.parse(punchedAt) > AUTO_ROUND_WINDOW_MS) return false
  return roundCounts(websites, round).unchecked > 0
}
