import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NetlifyError, readDailyTotals, readDayRankings } from './netlify'

const DETROIT = 'America/Detroit'
// Netlify's buckets start at local midnight: Nov 23 and Nov 24 2026 in Detroit.
const NOV_23 = Date.parse('2026-11-23T05:00:00Z')
const NOV_24 = Date.parse('2026-11-24T05:00:00Z')

const fetchMock = vi.fn()

function answer(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), { status })
}

beforeEach(() => {
  vi.stubEnv('NETLIFY_API_TOKEN', 'token-1')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('readDailyTotals', () => {
  it('joins pageviews, visitors and bandwidth by day', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/pageviews?'))
        return answer([
          [NOV_23, 51],
          [NOV_24, 91],
        ])
      if (url.includes('/visitors?'))
        return answer([
          [NOV_23, 46],
          [NOV_24, 59],
        ])
      return answer([
        { start: NOV_23, siteBandwidth: 7_229_316 },
        { start: NOV_24, siteBandwidth: 9_794_683 },
      ])
    })

    expect(await readDailyTotals('site-1', '2026-11-23', '2026-11-24', DETROIT)).toEqual([
      { day: '2026-11-23', pageviews: 51, visitors: 46, bandwidthBytes: 7_229_316 },
      { day: '2026-11-24', pageviews: 91, visitors: 59, bandwidthBytes: 9_794_683 },
    ])
  })

  it('asks for local days with the token and the zone offset', async () => {
    fetchMock.mockImplementation(async () => answer([]))

    await readDailyTotals('site-1', '2026-11-23', '2026-11-24', DETROIT)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/site-1/pageviews?')
    expect(url).toContain(`from=${NOV_23}`)
    expect(url).toContain(`to=${Date.parse('2026-11-25T05:00:00Z')}`)
    expect(url).toContain('timezone=-0500')
    expect(init.headers).toEqual({ authorization: 'Bearer token-1' })
  })

  it('ignores points that are not numbers', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/bandwidth?')
        ? answer([{ start: 'x' }])
        : answer([
            [NOV_23, 5],
            ['bad', 2],
          ]),
    )

    expect(await readDailyTotals('site-1', '2026-11-23', '2026-11-23', DETROIT)).toEqual([
      { day: '2026-11-23', pageviews: 5, visitors: 5, bandwidthBytes: 0 },
    ])
  })

  it('fails with the status Netlify gave', async () => {
    fetchMock.mockImplementation(async () => answer(null, 401))

    await expect(readDailyTotals('site-1', '2026-11-23', '2026-11-23', DETROIT)).rejects.toThrow(
      'Netlify answered 401 for pageviews.',
    )
  })

  it('fails before calling when no token is set', async () => {
    vi.stubEnv('NETLIFY_API_TOKEN', '')

    await expect(
      readDailyTotals('site-1', '2026-11-23', '2026-11-23', DETROIT),
    ).rejects.toBeInstanceOf(NetlifyError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('readDayRankings', () => {
  it('reads the top 50 sources, pages and countries for the day', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/ranking/sources?')) {
        return answer([
          { count: 55, resource: '' },
          { count: 1, resource: 'google.com' },
        ])
      }
      if (url.includes('/ranking/pages?')) return answer([{ count: 60, resource: '/' }])
      return answer([{ count: 40, resource: 'US', country_name: 'United States' }])
    })

    expect(await readDayRankings('site-1', '2026-11-24', DETROIT)).toEqual({
      sources: [
        { resource: '', count: 55 },
        { resource: 'google.com', count: 1 },
      ],
      pages: [{ resource: '/', count: 60 }],
      countries: [{ resource: 'US', count: 40, label: 'United States' }],
    })
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('&limit=50'))).toBe(true)
  })
})
