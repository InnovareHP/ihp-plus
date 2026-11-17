import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, within } from '@/test/render'
import type { DailyTaskKpiRow } from '../schema'
import { DailyTaskKpiPanel } from './daily-task-kpi-panel'

const rpc = vi.hoisted(() => ({ getDailyTaskKpis: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('next/navigation', () => ({
  usePathname: () => '/attendance/team',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('tab=kpis&from=2026-11-01&to=2026-11-16'),
}))

const ROWS: DailyTaskKpiRow[] = [
  {
    userId: 'dana',
    userName: 'Dana Reyes',
    jobTitle: 'Nurse',
    daysWorked: 10,
    planned: 30,
    completed: 24,
    overdue: 3,
    carriedOver: 4,
  },
  {
    userId: 'eli',
    userName: 'Eli Cruz',
    jobTitle: undefined,
    daysWorked: 0,
    planned: 0,
    completed: 0,
    overdue: 0,
    carriedOver: 0,
  },
]

describe('DailyTaskKpiPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDailyTaskKpis.mockResolvedValue(ROWS)
  })

  it('reads the range from the URL and totals the team', async () => {
    render(<DailyTaskKpiPanel />)

    const table = await screen.findByRole('table', { name: 'Daily task KPIs per employee' })
    expect(rpc.getDailyTaskKpis).toHaveBeenCalledWith({ from: '2026-11-01', to: '2026-11-16' })
    expect(within(table).getByRole('rowheader', { name: /Dana Reyes/ })).toBeInTheDocument()
    expect(within(table).getAllByText('80%').length).toBeGreaterThan(0)
    // Nothing planned reads as no rate, not as a failing 0%.
    expect(within(table).getByText('—')).toBeInTheDocument()
    expect(screen.getByText('30', { selector: 'p' })).toBeInTheDocument()
  })

  it('says what failed and retries', async () => {
    rpc.getDailyTaskKpis.mockRejectedValueOnce(new Error('Only an admin reads the team’s KPIs.'))
    render(<DailyTaskKpiPanel />)

    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(rpc.getDailyTaskKpis).toHaveBeenCalledTimes(2)
  })

  it('has no axe violations', async () => {
    const { container } = render(<DailyTaskKpiPanel />)
    await screen.findByRole('table')
    expect(await axe(container)).toHaveNoViolations()
  })
})
