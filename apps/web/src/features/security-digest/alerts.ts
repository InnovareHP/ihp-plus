import { recentAlerts, type PublicAlert } from './utils/alert-feed'

export const CISA_FEED_URL = 'https://www.cisa.gov/cybersecurity-advisories/all.xml'

/** Recent CISA alerts, or none: a slow or broken feed must never stop the weekly draft. */
export async function fetchPublicAlerts(now = new Date()): Promise<PublicAlert[]> {
  try {
    const response = await fetch(CISA_FEED_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/rss+xml, application/xml' },
      cache: 'no-store',
    })
    if (!response.ok) {
      console.error('[security-digest] CISA feed answered', response.status)
      return []
    }
    return recentAlerts(await response.text(), now)
  } catch (error) {
    console.error('[security-digest] CISA feed unreachable', error)
    return []
  }
}
