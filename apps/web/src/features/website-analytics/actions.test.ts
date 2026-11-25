import { beforeEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => ({ websitesAccess: vi.fn() }))
const ga4 = vi.hoisted(() => {
  class Ga4Error extends Error {}
  return { Ga4Error, readGa4Report: vi.fn() }
})

const prisma = vi.hoisted(() => ({ websiteAnalyticsDay: { findMany: vi.fn() } }))

vi.mock('@/features/websites/access', () => access)
vi.mock('./ga4', () => ga4)
vi.mock('@ihp/db', () => ({ db: prisma }))

const { loadGa4Report, loadNetlifyReport } = await import('./actions')

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-26T15:00:00Z') })
  access.websitesAccess
    .mockReset()
    .mockResolvedValue({ canViewAnalytics: true, organizationId: 'org-1' })
  prisma.websiteAnalyticsDay.findMany.mockReset().mockResolvedValue([])
  ga4.readGa4Report.mockReset().mockResolvedValue({ totals: { sessions: 96 } })
})

describe('loadGa4Report', () => {
  it('reads the site for an admin', async () => {
    const result = await loadGa4Report('palm-grove', '2026-10-01', '2026-10-31')

    expect(result).toEqual({ ok: true, data: { totals: { sessions: 96 } } })
    expect(ga4.readGa4Report).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'palm-grove', sourceId: '558752520' }),
      { start: '2026-10-01', end: '2026-10-31' },
    )
  })

  it('refuses anyone who is not an admin', async () => {
    access.websitesAccess.mockResolvedValue({ canViewAnalytics: false })

    const result = await loadGa4Report('palm-grove', '2026-10-01', '2026-10-31')

    expect(result).toEqual({ ok: false, message: 'Only an admin can read website analytics.' })
    expect(ga4.readGa4Report).not.toHaveBeenCalled()
  })

  it('refuses a Netlify site and a range that is not whole past days', async () => {
    expect((await loadGa4Report('rivers-residence', '2026-10-01', '2026-10-31')).ok).toBe(false)
    for (const [start, end] of [
      ['2026-10-31', '2026-10-01'],
      ['2026-11-01', '2026-11-26'],
      ['2025-01-01', '2026-10-31'],
      ['soon', '2026-10-31'],
    ] as const) {
      expect((await loadGa4Report('palm-grove', start, end)).ok).toBe(false)
    }
    expect(ga4.readGa4Report).not.toHaveBeenCalled()
  })

  it('passes on what Google said when the read fails', async () => {
    ga4.readGa4Report.mockRejectedValue(
      new ga4.Ga4Error('The service account cannot read GA4 property 558752520.'),
    )

    expect(await loadGa4Report('palm-grove', '2026-10-01', '2026-10-31')).toEqual({
      ok: false,
      message:
        'Could not read Palm Grove from Google Analytics: The service account cannot read GA4 property 558752520.',
    })
  })
})

describe('loadNetlifyReport', () => {
  it('reads only this organization’s saved days for the range and the one before', async () => {
    prisma.websiteAnalyticsDay.findMany.mockResolvedValue([
      {
        day: new Date('2026-10-02T00:00:00Z'),
        pageviews: 40,
        visitors: 30,
        bandwidthBytes: 5_000_000n,
        sources: [],
        pages: [{ resource: '/', count: 40 }],
        countries: [],
      },
    ])

    const result = await loadNetlifyReport('rivers-residence', '2026-10-01', '2026-10-03')

    expect(prisma.websiteAnalyticsDay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          day: {
            gte: new Date('2026-09-28T00:00:00Z'),
            lte: new Date('2026-10-03T00:00:00Z'),
          },
        }),
      }),
    )
    expect(result.ok && result.data.totals).toEqual({
      pageviews: 40,
      visitors: 30,
      bandwidthBytes: 5_000_000,
    })
  })

  it('refuses a non-admin and a GA4 site before reading anything', async () => {
    expect((await loadNetlifyReport('palm-grove', '2026-10-01', '2026-10-03')).ok).toBe(false)
    access.websitesAccess.mockResolvedValue({ canViewAnalytics: false, organizationId: 'org-1' })
    expect((await loadNetlifyReport('rivers-residence', '2026-10-01', '2026-10-03')).ok).toBe(false)
    expect(prisma.websiteAnalyticsDay.findMany).not.toHaveBeenCalled()
  })

  it('says so when the saved numbers cannot be read', async () => {
    prisma.websiteAnalyticsDay.findMany.mockRejectedValue(new Error('connection lost'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await loadNetlifyReport('rivers-residence', '2026-10-01', '2026-10-03')).toEqual({
      ok: false,
      message:
        'Could not read the saved Netlify numbers for Rivers Residence. Try again in a minute.',
    })
  })
})
