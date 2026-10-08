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
