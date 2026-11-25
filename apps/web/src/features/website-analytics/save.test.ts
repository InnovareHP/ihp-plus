import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  organization: { findFirst: vi.fn(), findMany: vi.fn() },
  websiteAnalyticsDay: { upsert: vi.fn() },
}))
const netlify = vi.hoisted(() => ({ readDailyTotals: vi.fn(), readDayRankings: vi.fn() }))
const sites = vi.hoisted(() => ({
  REPORT_TIME_ZONE: 'America/Detroit',
  NETLIFY_SITES: [
    { name: 'Alpha', sourceId: 'site-a' },
    { name: 'Beta', sourceId: 'site-b' },
  ],
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./netlify', () => netlify)
vi.mock('./sites', () => sites)

const { saveNetlifyDays } = await import('./save')

// Midday Nov 25 in Detroit: yesterday is Nov 24.
const now = new Date('2026-11-25T17:00:00Z')
const RANKED = {
  sources: [{ resource: 'google.com', count: 3 }],
  pages: [{ resource: '/', count: 9 }],
  countries: [{ resource: 'US', count: 8, label: 'United States' }],
}

function totalsFor(first: string, last: string) {
  const days: string[] = []
  for (let day = first; day <= last;) {
    days.push(day)
    const next = new Date(`${day}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    day = next.toISOString().slice(0, 10)
  }
  return days.map((day) => ({ day, pageviews: 10, visitors: 7, bandwidthBytes: 1000 }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ORG_SLUG', 'ihp')
  prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' })
  netlify.readDailyTotals.mockImplementation(async (_id: string, first: string, last: string) =>
    totalsFor(first, last),
  )
  netlify.readDayRankings.mockResolvedValue(RANKED)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('saveNetlifyDays', () => {
  it('saves yesterday and the day before for every site, with their rankings', async () => {
    const summary = await saveNetlifyDays(2, now)

    expect(summary).toEqual({ sites: 2, days: 2, saved: 4, failed: [] })
    expect(netlify.readDailyTotals).toHaveBeenCalledWith(
      'site-a',
      '2026-11-23',
      '2026-11-24',
      'America/Detroit',
    )
    expect(prisma.websiteAnalyticsDay.upsert).toHaveBeenCalledWith({
      where: {
        netlifySiteId_day: { netlifySiteId: 'site-a', day: new Date('2026-11-24T00:00:00Z') },
      },
      create: {
        organizationId: 'org-1',
        netlifySiteId: 'site-a',
        day: new Date('2026-11-24T00:00:00Z'),
        pageviews: 10,
        visitors: 7,
        bandwidthBytes: 1000n,
        ...RANKED,
      },
      update: { pageviews: 10, visitors: 7, bandwidthBytes: 1000n, ...RANKED, savedAt: now },
    })
  })

  it('leaves rankings alone on days older than Netlify keeps them', async () => {
    await saveNetlifyDays(89, now)

    // 29 recent days per site carry rankings; the other 60 update totals only.
    expect(netlify.readDayRankings).toHaveBeenCalledTimes(29 * 2)
    const oldest = prisma.websiteAnalyticsDay.upsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>
    }
    expect(oldest.update).not.toHaveProperty('sources')
  })

  it('keeps saved visitors and rankings once Netlify has dropped them', async () => {
    netlify.readDailyTotals.mockResolvedValue([
      { day: '2026-11-24', pageviews: 10, visitors: null, bandwidthBytes: 1000 },
    ])
    netlify.readDayRankings.mockResolvedValue({ sources: [], pages: [], countries: [] })

    await saveNetlifyDays(1, now)

    const call = prisma.websiteAnalyticsDay.upsert.mock.calls[0]?.[0] as {
      create: Record<string, unknown>
      update: Record<string, unknown>
    }
    expect(call.update).toEqual({ pageviews: 10, bandwidthBytes: 1000n, savedAt: now })
    expect(call.create).toMatchObject({ visitors: 0, pageviews: 10 })
  })

  it('carries on past a site Netlify refuses and names it', async () => {
    netlify.readDailyTotals.mockImplementation(async (id: string, first: string, last: string) => {
      if (id === 'site-a') throw new Error('Netlify answered 500 for pageviews.')
      return totalsFor(first, last)
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await saveNetlifyDays(2, now)).toEqual({
      sites: 2,
      days: 2,
      saved: 2,
      failed: ['Alpha'],
    })
  })

  it('uses the only organization when ORG_SLUG names none', async () => {
    vi.stubEnv('ORG_SLUG', '')
    prisma.organization.findMany.mockResolvedValue([{ id: 'org-solo' }])

    await saveNetlifyDays(1, now)

    expect(prisma.websiteAnalyticsDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ organizationId: 'org-solo' }) }),
    )
  })

  it('refuses to guess between several organizations', async () => {
    vi.stubEnv('ORG_SLUG', '')
    prisma.organization.findMany.mockResolvedValue([{ id: 'one' }, { id: 'two' }])

    await expect(saveNetlifyDays(1, now)).rejects.toThrow('Set ORG_SLUG')
    expect(prisma.websiteAnalyticsDay.upsert).not.toHaveBeenCalled()
  })
})
