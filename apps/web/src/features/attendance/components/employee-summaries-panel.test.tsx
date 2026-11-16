import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, within } from '@/test/render'
import type { BillingStatementRow, EmployeeSummaryRow } from '../schema'
import { EmployeeSummariesPanel } from './employee-summaries-panel'

const rpc = vi.hoisted(() => ({ listEmployeeSummaries: vi.fn() }))
const output = vi.hoisted(() => ({ reissueStatement: vi.fn() }))
const search = vi.hoisted(() => ({ value: 'tab=summaries&from=2026-11-01&to=2026-11-15' }))

vi.mock('../rpc', () => rpc)
vi.mock('../utils/statement-output', () => output)
vi.mock('next/navigation', () => ({
  usePathname: () => '/attendance/team',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
}))

const STATEMENT = {
  id: 'st-1',
  userId: 'dana',
  invoiceNumber: 'INV-20261115',
  invoiceDate: '2026-11-15',
  periodStart: '2026-11-01',
  periodEnd: '2026-11-15',
  hoursWorked: 80,
  totalCents: 360_000,
} as BillingStatementRow

const SUMMARIES: EmployeeSummaryRow[] = [
  {
    userId: 'dana',
    userName: 'Dana Reyes',
    jobTitle: 'Nurse',
    daysWorked: 10,
    hoursWorked: 80,
    paidDaysOff: 0,
    tasks: [
      { id: 't1', name: 'Chart reviews', dueDate: '2026-11-03', isDone: true },
      { id: 't2', name: 'Call families', dueDate: '2026-11-03', isDone: false },
    ],
    statements: [STATEMENT],
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

describe('EmployeeSummariesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    search.value = 'tab=summaries&from=2026-11-01&to=2026-11-15'
    rpc.listEmployeeSummaries.mockResolvedValue(SUMMARIES)
  })

  it('shows each employee’s time read-only, their tasks and their invoice', async () => {
    render(<EmployeeSummariesPanel />)

    const dana = await screen.findByRole('article', { name: 'Dana Reyes' })
    expect(rpc.listEmployeeSummaries).toHaveBeenCalledWith({ from: '2026-11-01', to: '2026-11-15' })
    expect(within(dana).getByText('Days worked', { selector: 'dt' }).nextSibling).toHaveTextContent(
      '10',
    )
    expect(
      within(dana).getByText('Hours worked', { selector: 'dt' }).nextSibling,
    ).toHaveTextContent('80')
    expect(within(dana).queryByRole('textbox')).toBeNull()
    expect(within(dana).queryByRole('spinbutton')).toBeNull()
    expect(within(dana).getByText('1 of 2 tasks done (50%)')).toBeInTheDocument()
    expect(within(dana).getByRole('rowheader', { name: 'Call families' })).toBeInTheDocument()
    expect(within(dana).getByText('INV-20261115')).toBeInTheDocument()

    const eli = screen.getByRole('article', { name: 'Eli Cruz' })
    expect(within(eli).getByText('No billing statement filed for this period yet.')).toBeVisible()
  })

  it('downloads an employee’s invoice from the summary', async () => {
    render(<EmployeeSummariesPanel />)
    const dana = await screen.findByRole('article', { name: 'Dana Reyes' })

    await userEvent.click(within(dana).getByRole('button', { name: /INV-20261115/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Download PDF' }))

    expect(output.reissueStatement).toHaveBeenCalledWith(STATEMENT, 'pdf')
  })

  it('narrows to the employee in the URL', async () => {
    search.value += '&user=eli'
    render(<EmployeeSummariesPanel />)

    expect(await screen.findByRole('article', { name: 'Eli Cruz' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Dana Reyes' })).toBeNull()
  })

  it('says what failed and retries', async () => {
    rpc.listEmployeeSummaries.mockRejectedValueOnce(
      new Error('Only an admin reads employee summaries.'),
    )
    render(<EmployeeSummariesPanel />)

    expect(await screen.findByText('Only an admin reads employee summaries.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('article', { name: 'Dana Reyes' })).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<EmployeeSummariesPanel />)
    await screen.findByRole('article', { name: 'Dana Reyes' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
