// Second-level labels registries sell under a country code, so "acme.com.ph" is the domain, not "com.ph".
const SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'or', 'ne'])

/** The name a registry knows the site by: "shop.acme.co.uk" is registered as "acme.co.uk". */
export function registrableDomain(url: string): string | undefined {
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return undefined
  }
  const labels = hostname.split('.').filter(Boolean)
  // An IP address or a bare name has no registration to look up.
  if (labels.length < 2 || /^\d+$/.test(labels[labels.length - 1] ?? '')) return undefined

  const top = labels[labels.length - 1] ?? ''
  const second = labels[labels.length - 2] ?? ''
  const keep = top.length === 2 && SECOND_LEVEL.has(second) && labels.length >= 3 ? 3 : 2
  return labels.slice(-keep).join('.')
}

/** Whole days from now until an expiry date, negative once it has passed. */
export function daysUntil(at: string, now: Date) {
  return Math.floor((Date.parse(at) - now.getTime()) / (24 * 60 * 60 * 1000))
}

/** Close enough that renewing it belongs on this week's list. */
export const EXPIRY_WARNING_DAYS = 30
