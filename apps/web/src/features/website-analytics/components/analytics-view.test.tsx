import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { Ga4Report } from '../ga4'
import { AnalyticsView } from './analytics-view'

const nav = vi.hoisted(() => ({ query: '', replace: vi.fn() }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/websites',
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.query),
}))

const actions = vi.hoisted(() => ({ loadGa4Report: vi.fn() }))
vi.mock('../actions', () => actions)

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

beforeEach(() => {
  nav.query = 'tab=analytics'
  nav.replace.mockReset()
  actions.loadGa4Report.mockReset().mockResolvedValue({ ok: true, data: REPORT })
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

  it('does not ask Google about a Netlify site', async () => {
    nav.query = 'tab=analytics&site=rivers-residence'
    render(<AnalyticsView today={TODAY} />)

    await waitFor(() => expect(screen.getByText(/Netlify numbers/)).toBeInTheDocument())
    expect(actions.loadGa4Report).not.toHaveBeenCalled()
  })
})
