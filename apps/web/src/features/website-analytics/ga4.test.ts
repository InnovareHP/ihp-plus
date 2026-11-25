import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReportSite } from './sites'

const auth = vi.hoisted(() => ({ analyticsToken: vi.fn(async () => 'token-1') }))
vi.mock('./google-auth', () => auth)

const { Ga4Error, readGa4Report } = await import('./ga4')

const fetchMock = vi.fn()

const SITE: ReportSite = {
  key: 'palm-grove',
  name: 'Palm Grove',
  domain: '',
  source: 'ga4',
  sourceId: '558752520',
  callEvents: ['phone_call', 'email_click'],
  seo: true,
}
const RANGE = { start: '2026-10-01', end: '2026-10-03' }

type Cell = string | number
function report(dims: string[], metrics: string[], rows: Cell[][], timeZone?: string) {
  return {
    dimensionHeaders: dims.map((name) => ({ name })),
    metricHeaders: metrics.map((name) => ({ name })),
    rows: rows.map((row) => ({
      dimensionValues: row.slice(0, dims.length).map((value) => ({ value: String(value) })),
      metricValues: row.slice(dims.length).map((value) => ({ value: String(value) })),
    })),
    ...(timeZone ? { metadata: { timeZone } } : {}),
  }
}

const TOTALS = report(
  ['dateRange'],
  [
    'sessions',
    'totalUsers',
    'newUsers',
    'screenPageViews',
    'averageSessionDuration',
    'engagementRate',
  ],
  [
    ['current', 96, 69, 69, 159, 92.5, 0.32],
    ['previous', 40, 30, 28, 70, 60, 0.25],
  ],
  'America/New_York',
)
const CHANNELS = report(
  ['sessionDefaultChannelGroup', 'dateRange'],
  ['sessions'],
  [
    ['Direct', 'current', 72],
    ['Organic Search', 'current', 24],
    ['Organic Search', 'previous', 10],
  ],
)
const DAYS = report(
  ['nthDay', 'dateRange'],
  ['sessions'],
  [
    ['0000', 'current', 5],
    ['0002', 'current', 9],
    ['0001', 'previous', 4],
  ],
)
const LANDING = report(['landingPage'], ['sessions', 'engagementRate'], [['/', 69, 0.3]])
const SOURCES = report(
  ['sessionSourceMedium'],
  ['sessions', 'engagementRate'],
  [['google / organic', 23, 0.5]],
)
const CALLS = report(
  ['dateRange'],
  ['eventCount'],
  [
    ['current', 4],
    ['previous', 1],
  ],
)
const SEO = report(
  ['landingPagePlusQueryString'],
  [
    'organicGoogleSearchClicks',
    'organicGoogleSearchImpressions',
    'organicGoogleSearchAveragePosition',
  ],
  [
    ['/', 9, 30, 4],
    ['/about', 1, 10, 8],
    ['/never-shown', 0, 0, 0],
  ],
)

function answer(reports: unknown[], status = 200) {
  return new Response(
    JSON.stringify(status === 200 ? { reports } : { error: { message: 'bad' } }),
    {
      status,
    },
  )
}

function requestsOf(call: number) {
  const init = fetchMock.mock.calls[call]?.[1] as RequestInit
  return (JSON.parse(String(init.body)) as { requests: Record<string, unknown>[] }).requests
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock
    .mockResolvedValueOnce(answer([TOTALS, CHANNELS, DAYS, LANDING, SOURCES]))
    .mockResolvedValueOnce(answer([CALLS, SEO]))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readGa4Report', () => {
  it('builds the tiles for the range and the period before it', async () => {
    const result = await readGa4Report(SITE, RANGE)

    expect(result.previous).toEqual({ start: '2026-09-28', end: '2026-09-30' })
    expect(result.timeZone).toBe('America/New_York')
    expect(result.totals).toEqual({
      sessions: 96,
      totalUsers: 69,
      newUsers: 69,
      pageViews: 159,
      avgSessionSeconds: 92.5,
      engagementRate: 0.32,
      organicSearchVisits: 24,
      callsAndEmails: 4,
    })
    expect(result.previousTotals).toMatchObject({
      sessions: 40,
      organicSearchVisits: 10,
      callsAndEmails: 1,
    })
  })

  it('lays sessions out day by day, with zero for days GA4 left out', async () => {
    const result = await readGa4Report(SITE, RANGE)

    expect(result.sessionsByDay).toEqual([
      { day: '2026-10-01', sessions: 5, previousSessions: 0 },
      { day: '2026-10-02', sessions: 0, previousSessions: 4 },
      { day: '2026-10-03', sessions: 9, previousSessions: 0 },
    ])
  })

  it('lists channels, landing pages and sources for the range', async () => {
    const result = await readGa4Report(SITE, RANGE)

    expect(result.channels).toEqual([
      { channel: 'Direct', sessions: 72 },
      { channel: 'Organic Search', sessions: 24 },
    ])
    expect(result.landingPages).toEqual([{ label: '/', sessions: 69, engagementRate: 0.3 }])
    expect(result.sources).toEqual([
      { label: 'google / organic', sessions: 23, engagementRate: 0.5 },
    ])
  })

  it('sums Google search per page and weighs position by impressions', async () => {
    const result = await readGa4Report(SITE, RANGE)

    expect(result.seo).toEqual({
      clicks: 10,
      impressions: 40,
      clickThroughRate: 0.25,
      averagePosition: 5,
      pages: [
        { page: '/', clicks: 9, impressions: 30, position: 4 },
        { page: '/about', clicks: 1, impressions: 10, position: 8 },
      ],
    })
  })

  it('asks for the call events by name with the token', async () => {
    await readGa4Report(SITE, RANGE)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://analyticsdata.googleapis.com/v1beta/properties/558752520:batchRunReports',
    )
    expect(init.headers).toMatchObject({ authorization: 'Bearer token-1' })
    expect(requestsOf(0)).toHaveLength(5)
    expect(requestsOf(1)[0]?.dimensionFilter).toEqual({
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: ['phone_call', 'email_click'] },
      },
    })
  })

  it('leaves out the calls tile and SEO for a site that has neither', async () => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(answer([TOTALS, CHANNELS, DAYS, LANDING, SOURCES]))

    const result = await readGa4Report({ ...SITE, callEvents: [], seo: false }, RANGE)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.totals.callsAndEmails).toBeNull()
    expect(result.seo).toBeNull()
  })

  it('leaves out SEO when Search Console has no rows yet', async () => {
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce(answer([TOTALS, CHANNELS, DAYS, LANDING, SOURCES]))
      .mockResolvedValueOnce(answer([report(['landingPagePlusQueryString'], [], [])]))

    const result = await readGa4Report({ ...SITE, callEvents: [] }, RANGE)

    expect(result.seo).toBeNull()
  })

  it('says plainly when the service account has no access', async () => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(answer([], 403))

    await expect(readGa4Report(SITE, RANGE)).rejects.toThrow(
      'The service account cannot read GA4 property 558752520.',
    )
  })

  it('refuses a Netlify site and a backwards range before calling', async () => {
    fetchMock.mockReset()

    await expect(readGa4Report({ ...SITE, source: 'netlify' }, RANGE)).rejects.toBeInstanceOf(
      Ga4Error,
    )
    await expect(
      readGa4Report(SITE, { start: '2026-10-03', end: '2026-10-01' }),
    ).rejects.toBeInstanceOf(Ga4Error)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
