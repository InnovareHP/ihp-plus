import { beforeEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => ({ websitesAccess: vi.fn() }))
const ga4 = vi.hoisted(() => {
  class Ga4Error extends Error {}
  return { Ga4Error, readGa4Report: vi.fn() }
})

vi.mock('@/features/websites/access', () => access)
vi.mock('./ga4', () => ga4)

const { loadGa4Report } = await import('./actions')

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-26T15:00:00Z') })
  access.websitesAccess.mockReset().mockResolvedValue({ canViewAnalytics: true })
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
