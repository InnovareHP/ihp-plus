import { daysUntil, EXPIRY_WARNING_DAYS } from './domain'

/** The days before a renewal on which the IT lead hears about it; one email each, no state kept. */
export const ALERT_DAYS = new Set([30, 14, 7, 3, 1, 0])

export interface SiteExpiry {
  name: string
  domain: string | undefined
  ssl: string | undefined
}

function formatDate(at: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(at))
}

function left(days: number) {
  if (days < 0) return 'expired'
  if (days === 0) return 'today'
  return days === 1 ? '1 day' : `${days} days`
}

function part(label: string, at: string | undefined, timeZone: string, now: Date) {
  if (!at) return `${label} not available`
  return `${label} ${formatDate(at, timeZone)} (${left(daysUntil(at, now))})`
}

/** One line per site for the monthly email, soonest renewal first. */
export function monthlyLines(sites: readonly SiteExpiry[], timeZone: string, now: Date) {
  const soonest = (site: SiteExpiry) =>
    Math.min(
      ...[site.domain, site.ssl].map((at) => (at ? daysUntil(at, now) : Number.POSITIVE_INFINITY)),
    )
  return [...sites]
    .sort((a, b) => soonest(a) - soonest(b) || a.name.localeCompare(b.name))
    .map(
      (site) =>
        `${site.name}: ${part('domain', site.domain, timeZone, now)}, ${part('SSL', site.ssl, timeZone, now)}`,
    )
}

export function expiringSoonCount(sites: readonly SiteExpiry[], now: Date) {
  return sites.filter((site) =>
    [site.domain, site.ssl].some((at) => at && daysUntil(at, now) <= EXPIRY_WARNING_DAYS),
  ).length
}

// An expired renewal is repeated weekly, not daily, so a lapsed site cannot flood the inbox.
function isAlertDay(days: number) {
  return ALERT_DAYS.has(days) || (days < 0 && days % 7 === 0)
}

/** The renewals that hit an alert day today; empty on most days, so nothing is sent. */
export function alertLines(sites: readonly SiteExpiry[], timeZone: string, now: Date) {
  const lines: string[] = []
  for (const site of sites) {
    for (const [label, at] of [
      ['domain', site.domain],
      ['SSL certificate', site.ssl],
    ] as const) {
      if (!at) continue
      const days = daysUntil(at, now)
      if (!isAlertDay(days)) continue
      lines.push(
        days < 0
          ? `${site.name}: ${label} expired on ${formatDate(at, timeZone)}`
          : `${site.name}: ${label} expires ${formatDate(at, timeZone)} (${left(days)})`,
      )
    }
  }
  return lines
}
