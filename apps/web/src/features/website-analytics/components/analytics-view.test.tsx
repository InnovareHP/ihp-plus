import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import type { Ga4Report } from '../ga4'
import { buildNetlifyReport } from '../netlify-report'
import { AnalyticsView } from './analytics-view'

const nav = vi.hoisted(() => ({ query: '', replace: vi.fn() }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/websites',
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.query),
}))

const actions = vi.hoisted(() => ({
  loadGa4Report: vi.fn(),
  loadNetlifyReport: vi.fn(),
  loadTakeaways: vi.fn(),
  loadTakeawayStatus: vi.fn(),
  saveTakeaways: vi.fn(),
  downloadReportPdf: vi.fn(),
  downloadAllReports: vi.fn(),
}))
vi.mock('../actions', () => actions)
const download = vi.hoisted(() => ({ downloadFile: vi.fn() }))
vi.mock('@/lib/download', () => download)

const TODAY = '2026-11-26'

const TOTALS = {
  sessions: 96,
  totalUsers: 69,
  newUsers: 69,
  pageViews: 159,
  avgSessionSeconds: 92.5,
  engagementRate: 0.323,
  organicSearchVisits: 24,
  callsAndEmails: 4,
}
const REPORT: Ga4Report = {
  range: { start: '2026-10-27', end: '2026-11-25' },
  previous: { start: '2026-09-27', end: '2026-10-26' },
  timeZone: 'America/New_York',
  totals: TOTALS,
  previousTotals: { ...TOTALS, sessions: 40, callsAndEmails: 0 },
  sessionsByDay: [
    { day: '2026-10-27', sessions: 5, previousSessions: 2 },
    { day: '2026-10-28', sessions: 7, previousSessions: 1 },
  ],
  channels: [
    { channel: 'Direct', sessions: 72 },
    { channel: 'Organic Search', sessions: 24 },
  ],
  landingPages: [{ label: '/', sessions: 69, engagementRate: 0.3 }],
  sources: [{ label: 'google / organic', sessions: 23, engagementRate: 0.5 }],
  seo: {
    clicks: 10,
    impressions: 28,
    clickThroughRate: 10 / 28,
    averagePosition: 4.25,
    pages: [{ page: '/', clicks: 9, impressions: 20, position: 4 }],
  },
}

const NETLIFY_RANGE = { start: '2026-10-27', end: '2026-11-25' }
const NETLIFY_PREVIOUS = { start: '2026-09-27', end: '2026-10-26' }
const SAVED = Array.from({ length: 30 }, (_, index) => {
  const day = new Date(Date.UTC(2026, 9, 27 + index)).toISOString().slice(0, 10)
  // The first week was saved after Netlify had already dropped its visitors and top lists.
  const forgotten = index < 7
  return {
    day,
    pageviews: index === 10 ? 130 : 60,
    visitors: forgotten ? 0 : 40,
    bandwidthBytes: 9_000_000,
    sources: forgotten
      ? []
      : [
          { resource: '', count: 45 },
          { resource: 'google.com', count: 2 },
        ],
    pages: forgotten ? [] : [{ resource: '/', count: 50 }],
    countries: forgotten ? [] : [{ resource: 'US', label: 'United States', count: 40 }],
  }
})

beforeEach(() => {
  nav.query = 'tab=analytics'
  nav.replace.mockReset()
  actions.loadGa4Report.mockReset().mockResolvedValue({ ok: true, data: REPORT })
  actions.loadTakeaways.mockReset().mockResolvedValue({ ok: true, data: null })
  actions.loadTakeawayStatus.mockReset().mockResolvedValue({ ok: true, data: ['palm-grove'] })
  actions.loadNetlifyReport.mockReset().mockResolvedValue({
    ok: true,
    data: buildNetlifyReport(SAVED, NETLIFY_RANGE, NETLIFY_PREVIOUS),
  })
})

describe('AnalyticsView', () => {
  it('opens on the first site and the last 30 days, against the 30 before', async () => {
    const { container } = render(<AnalyticsView today={TODAY} />)

    expect(screen.getByRole('heading', { name: 'Palm Grove' })).toBeInTheDocument()
    expect(screen.getByText(/Oct 27 – Nov 25, 2026 \(30 days\)/)).toBeInTheDocument()
    expect(screen.getByText(/compared with Sep 27 – Oct 26, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Google Analytics/, { selector: 'p' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows a Netlify site and a custom range from the address', () => {
    nav.query = 'tab=analytics&site=rivers-residence&range=custom&from=2026-10-01&to=2026-10-31'
    render(<AnalyticsView today={TODAY} />)

    expect(screen.getByRole('heading', { name: 'Rivers Residence' })).toBeInTheDocument()
    expect(screen.getByText(/Oct 1 – 31, 2026 \(31 days\)/)).toBeInTheDocument()
    expect(screen.getByText(/Michigan time/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Date range Custom/ })).toBeInTheDocument()
  })

  it('puts the chosen site and range in the address', async () => {
    const user = userEvent.setup()
    render(<AnalyticsView today={TODAY} />)

    await user.click(screen.getByRole('button', { name: /Date range/ }))
    await user.click(screen.getByRole('button', { name: 'Last 60 days' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/websites?tab=analytics&site=palm-grove&range=60d',
      { scroll: false },
    )

    await user.click(screen.getByRole('combobox', { name: 'Website' }))
    await user.click(screen.getByRole('option', { name: 'Magnolia' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/websites?tab=analytics&site=magnolia', {
      scroll: false,
    })
  })

  it('shows the tiles, charts and tables once Google answers', async () => {
    const { container } = render(<AnalyticsView today={TODAY} />)

    expect(screen.getByLabelText('Loading the report')).toBeInTheDocument()
    expect(await screen.findByText('Organic search visits')).toBeInTheDocument()
    expect(actions.loadGa4Report).toHaveBeenCalledWith('palm-grove', '2026-10-27', '2026-11-25')

    expect(screen.getByText('1m 32s')).toBeInTheDocument()
    expect(screen.getByText('32.3%')).toBeInTheDocument()
    expect(screen.getAllByText('+140% vs previous')).toHaveLength(1)
    expect(screen.getByText('Calls & emails')).toBeInTheDocument()
    expect(screen.getAllByText('No earlier data').length).toBeGreaterThan(0)
    expect(screen.getByRole('table', { name: 'Top landing pages' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Top sources' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Google search' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /96 this period against 40/ })).toBeInTheDocument()
    expect(screen.getByText(/America\/New York/)).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('says what went wrong and tries again on request', async () => {
    const user = userEvent.setup()
    actions.loadGa4Report.mockResolvedValueOnce({
      ok: false,
      message: 'Could not read Palm Grove from Google Analytics. Try again in a minute.',
    })
    render(<AnalyticsView today={TODAY} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in a minute.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Organic search visits')).toBeInTheDocument()
    expect(actions.loadGa4Report).toHaveBeenCalledTimes(2)
  })

  it('explains an empty range instead of showing a page of zeros', async () => {
    const zero = { ...TOTALS, sessions: 0 }
    actions.loadGa4Report.mockResolvedValue({
      ok: true,
      data: { ...REPORT, totals: zero, previousTotals: zero },
    })
    render(<AnalyticsView today={TODAY} />)

    expect(await screen.findByText(/recorded no visits to Palm Grove/)).toBeInTheDocument()
    expect(screen.queryByText('Organic search visits')).not.toBeInTheDocument()
  })

  it('leaves out the SEO section for a site without Search Console', async () => {
    nav.query = 'tab=analytics&site=ihp-global'
    render(<AnalyticsView today={TODAY} />)

    expect(await screen.findByText('Organic search visits')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Google search' })).not.toBeInTheDocument()
  })

  it('shows a Netlify site from its saved days and names the gaps', async () => {
    nav.query = 'tab=analytics&site=helping-with-moms-home'
    const { container } = render(<AnalyticsView today={TODAY} />)

    expect(await screen.findByText('Busiest day')).toBeInTheDocument()
    expect(actions.loadGa4Report).not.toHaveBeenCalled()
    expect(actions.loadNetlifyReport).toHaveBeenCalledWith(
      'helping-with-moms-home',
      '2026-10-27',
      '2026-11-25',
    )
    expect(screen.getByText('1,870')).toBeInTheDocument()
    expect(screen.getByText('Counted for 23 of 30 days')).toBeInTheDocument()
    expect(screen.queryByText('Pages per visitor')).not.toBeInTheDocument()
    expect(screen.getByText('Nov 6')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Direct' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'United States' })).toBeInTheDocument()
    expect(screen.getByText(/cover 23 of the 30 days/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Page views per day: 1,870/ })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('says when nothing is saved for a Netlify range', async () => {
    nav.query = 'tab=analytics&site=rivers-residence'
    actions.loadNetlifyReport.mockResolvedValue({
      ok: true,
      data: buildNetlifyReport([], NETLIFY_RANGE, NETLIFY_PREVIOUS),
    })
    render(<AnalyticsView today={TODAY} />)

    expect(
      await screen.findByText(/No Netlify numbers are saved for Rivers Residence/),
    ).toBeInTheDocument()
  })

  it('downloads this site’s PDF and offers takeaways and the zip for the same dates', async () => {
    const user = userEvent.setup()
    nav.query = 'tab=analytics&range=report-month'
    actions.downloadReportPdf.mockResolvedValue({
      ok: true,
      data: { fileName: 'Palm Grove.pdf', bytes: new Uint8Array([1]) },
    })
    render(<AnalyticsView today={TODAY} />)

    expect(await screen.findByRole('heading', { name: 'Takeaways' })).toBeInTheDocument()
    expect(await screen.findByText('Takeaways saved for 1 of 14 websites.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download PDF' }))

    expect(actions.downloadReportPdf).toHaveBeenCalledWith('palm-grove', '2026-10-25', '2026-11-24')
    expect(download.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'Palm Grove.pdf', contentType: 'application/pdf' }),
    )
  })
})
