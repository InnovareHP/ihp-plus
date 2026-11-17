import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, within } from '@/test/render'
import type { BillingStatementRow, EmployeeSummaryRow } from '../schema'
import { MonthlyReportPanel } from './monthly-report-panel'

const rpc = vi.hoisted(() => ({ listEmployeeSummaries: vi.fn() }))
const nav = vi.hoisted(() => ({ replace: vi.fn() }))
const mail = vi.hoisted(() => ({ openMailto: vi.fn() }))
const announce = vi.hoisted(() => ({ announceFailure: vi.fn(), announceSuccess: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@/lib/mailto', () => mail)
vi.mock('@/lib/announce', () => announce)
vi.mock('next/navigation', () => ({
  usePathname: () => '/attendance/team',
  useRouter: () => nav,
  useSearchParams: () => new URLSearchParams('tab=monthly&month=2026-10'),
}))

const SUMMARIES: EmployeeSummaryRow[] = [
  {
    userId: 'dana',
    userName: 'Dana Reyes',
    jobTitle: 'Nurse',
    daysWorked: 21,
    hoursWorked: 168,
    paidDaysOff: 0,
    tasks: [
      { id: 't1', name: 'Chart reviews', dueDate: '2026-10-03', isDone: true },
      { id: 't2', name: 'Call families', dueDate: '2026-10-03', isDone: false },
    ],
    statements: [{ periodEnd: '2026-10-31', totalCents: 420_000 } as BillingStatementRow],
  },
  {
    userId: 'eli',
    userName: 'Eli Cruz',
    jobTitle: undefined,
    daysWorked: 0,
    hoursWorked: 0,
    paidDaysOff: 0,
    tasks: [],
    statements: [],
  },
]

describe('MonthlyReportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listEmployeeSummaries.mockResolvedValue(SUMMARIES)
  })

  it('reads the whole month and shows accomplished tasks and salary', async () => {
    render(<MonthlyReportPanel />)

    const table = await screen.findByRole('table', { name: 'Monthly report for October 2026' })
    expect(rpc.listEmployeeSummaries).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31' })
    const dana = within(table)
      .getByRole('rowheader', { name: /Dana Reyes/ })
      .closest('tr')
    expect(dana).toHaveTextContent('1 of 2')
    expect(dana).toHaveTextContent('$4,200.00')
    const eli = within(table)
      .getByRole('rowheader', { name: /Eli Cruz/ })
      .closest('tr')
    expect(eli).toHaveTextContent('No statement')

    const done = screen.getByRole('table', { name: 'Accomplished by Dana Reyes' })
    expect(within(done).getByRole('rowheader', { name: 'Chart reviews' })).toBeInTheDocument()
    expect(within(done).queryByText('Call families')).toBeNull()
    expect(screen.getByText('Total salary').parentElement).toHaveTextContent('$4,200.00')
  })

  it('opens an email holding the whole report', async () => {
    render(<MonthlyReportPanel />)
    await screen.findByText('Total salary')
    await userEvent.click(screen.getByRole('button', { name: 'Email report' }))

    const url = new URL(mail.openMailto.mock.calls[0]?.[0] as string)
    expect(url.searchParams.get('subject')).toBe('Monthly report — October 2026')
    const body = url.searchParams.get('body') ?? ''
    expect(body).toContain('Dana Reyes (Nurse)')
    expect(body).toContain('Chart reviews')
    expect(body).toContain('Eli Cruz')
    expect(announce.announceSuccess).toHaveBeenCalledWith(
      expect.stringContaining('mail app is opening with the report'),
    )
  })

  it('pages to the previous month in the URL', async () => {
    render(<MonthlyReportPanel />)
    await userEvent.click(await screen.findByRole('button', { name: 'Previous month' }))
    expect(nav.replace).toHaveBeenCalledWith('/attendance/team?tab=monthly&month=2026-09', {
      scroll: false,
    })
  })

  it('says what failed and retries', async () => {
    rpc.listEmployeeSummaries.mockRejectedValueOnce(new Error('Only an admin reads reports.'))
    render(<MonthlyReportPanel />)

    expect(await screen.findByText('Only an admin reads reports.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Total salary')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<MonthlyReportPanel />)
    await screen.findByText('Total salary')
    expect(await axe(container)).toHaveNoViolations()
  })
})
