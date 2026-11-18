import { describe, expect, it } from 'vitest'
import { parseFeedDate, recentAlerts } from './alert-feed'

function item(title: string, link: string, pubDate: string, description = '') {
  return `<item>
  <title>${title}</title>
  <link>${link}</link>
  <description>${description}</description>
  <pubDate>${pubDate}</pubDate>
</item>`
}

const NOW = new Date('2026-11-18T12:00:00.000Z')

const FEED = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><title>All CISA Advisories</title>
${item(
  'Critical Java Vulnerability Requires Immediate Patching',
  'https://www.cisa.gov/news-events/alerts/2026/11/17/critical-java',
  'Tue, 17 Nov 26 12:00:00 +0000',
  '&lt;h2&gt;Purpose&lt;/h2&gt;&lt;p&gt;Patch &amp;amp; restart &lt;strong&gt;today&lt;/strong&gt;.&lt;/p&gt;',
)}
${item('Siemens ROS#', 'https://www.cisa.gov/news-events/ics-advisories/icsa-26-321-06', 'Tue, 17 Nov 26 12:00:00 +0000')}
${item(
  'CISA Adds One Known Exploited Vulnerability to Catalog',
  'https://www.cisa.gov/news-events/alerts/2026/11/17/kev',
  'Tue, 17 Nov 26 12:00:00 +0000',
)}
${item(
  'Post-Quantum Questions to Ask Your Vendors',
  'https://www.cisa.gov/resources-tools/resources/post-quantum',
  'Thu, 05 Nov 26 12:00:00 +0000',
)}
${item('Old guidance', 'https://www.cisa.gov/news-events/alerts/old', 'Mon, 05 Oct 26 12:00:00 +0000')}
</channel></rss>`

describe('parseFeedDate', () => {
  it('reads CISA’s two-digit years as this century', () => {
    expect(parseFeedDate('Tue, 17 Nov 26 12:00:00 +0000')?.toISOString()).toBe(
      '2026-11-17T12:00:00.000Z',
    )
  })

  it('gives up on a date it cannot read', () => {
    expect(parseFeedDate('yesterday')).toBeUndefined()
  })
})

describe('recentAlerts', () => {
  it('keeps recent staff-relevant items newest first, as plain text', () => {
    const alerts = recentAlerts(FEED, NOW)

    expect(alerts.map((alert) => alert.title)).toEqual([
      'Critical Java Vulnerability Requires Immediate Patching',
      'Post-Quantum Questions to Ask Your Vendors',
    ])
    expect(alerts[0]?.url).toBe('https://www.cisa.gov/news-events/alerts/2026/11/17/critical-java')
    expect(alerts[0]?.summary).toBe('Purpose Patch & restart today .')
  })

  it('drops industrial-control advisories and catalog additions', () => {
    const urls = recentAlerts(FEED, NOW).map((alert) => alert.url)

    expect(urls.some((url) => url.includes('/ics-advisories/'))).toBe(false)
    expect(urls.some((url) => url.endsWith('/kev'))).toBe(false)
  })

  it('caps how many it offers', () => {
    expect(recentAlerts(FEED, NOW, 21, 1)).toHaveLength(1)
  })

  it('returns nothing for a feed it cannot read', () => {
    expect(recentAlerts('<html>Service unavailable</html>', NOW)).toEqual([])
  })
})
