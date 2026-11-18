export interface PublicAlert {
  title: string
  url: string
  publishedAt: Date
  summary: string
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decode(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
}

function plainText(html: string) {
  return decode(decode(html))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// CISA writes two-digit years ("Tue, 17 Nov 26"), which Date parsing does not agree on.
export function parseFeedDate(value: string): Date | undefined {
  const match = /(\d{1,2})\s+([a-z]{3})\s+(\d{2,4})\s+(\d{2}):(\d{2})/i.exec(value)
  if (!match) return undefined
  const [, day, month, year, hour, minute] = match
  const monthIndex = MONTHS.indexOf((month ?? '').toLowerCase())
  if (monthIndex === -1) return undefined
  const fullYear = Number(year) < 100 ? 2000 + Number(year) : Number(year)
  return new Date(Date.UTC(fullYear, monthIndex, Number(day), Number(hour), Number(minute)))
}

function tag(item: string, name: string) {
  return new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(item)?.[1]?.trim() ?? ''
}

// Industrial-control advisories and catalog additions say nothing an office worker can act on.
function isForStaff(alert: { title: string; url: string }) {
  if (alert.url.includes('/ics-advisories/')) return false
  if (/known exploited vulnerabilit/i.test(alert.title)) return false
  return alert.url.startsWith('https://www.cisa.gov/')
}

/** The newest staff-relevant items from the last `days`, newest first. */
export function recentAlerts(xml: string, now: Date, days = 21, limit = 6): PublicAlert[] {
  const since = now.getTime() - days * 86_400_000
  const alerts: PublicAlert[] = []
  for (const [, item = ''] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = plainText(tag(item, 'title'))
    const url = decode(tag(item, 'link'))
    const publishedAt = parseFeedDate(tag(item, 'pubDate'))
    if (!title || !publishedAt || publishedAt.getTime() < since) continue
    if (!isForStaff({ title, url })) continue
    alerts.push({
      title,
      url,
      publishedAt,
      summary: plainText(tag(item, 'description')).slice(0, 900),
    })
  }
  return alerts
    .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime())
    .slice(0, limit)
}
