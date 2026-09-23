import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { datesOfMonth } from '../utils/calendar'
import type { CalendarDayRow, CalendarMonth } from '../schema'
import { CalendarPanel } from './calendar-panel'

const rpc = vi.hoisted(() => ({ getCalendar: vi.fn(), listHolidayCountries: vi.fn() }))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/attendance/calendar',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

function month(
  overrides: Partial<Record<string, Partial<CalendarDayRow>>> = {},
  canManage = false,
) {
  const days = datesOfMonth('2026-09').map((date): CalendarDayRow => ({
    date,
    state: 'scheduled',
    workedSeconds: 0,
    holidays: [],
    leave: [],
    ...overrides[date],
  }))
  return {
    month: '2026-09',
    today: '2026-09-24',
    timeZone: 'Asia/Manila',
    days,
    canManage,
    showsEveryone: canManage,
  } satisfies CalendarMonth
}

describe('CalendarPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.search = ''
    rpc.listHolidayCountries.mockResolvedValue([{ code: 'PH', name: 'Philippines' }])
    rpc.getCalendar.mockResolvedValue(
      month({
        '2026-09-21': { state: 'worked', workedSeconds: 8 * 3600 },
        '2026-09-22': { state: 'holiday', holidays: [{ name: 'Founders Day', country: '' }] },
        '2026-09-23': {
          state: 'leave',
          leave: [{ userId: 'user-1', userName: 'Grace', name: 'Vacation leave' }],
        },
        '2026-09-18': { state: 'absent' },
      }),
    )
  })

  it('lays the month out as a table and marks today', async () => {
    render(<CalendarPanel />)

    const grid = await screen.findByRole('table', { name: 'September 2026' })
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7)
    expect(within(grid).getByText('Worked 8h')).toBeInTheDocument()
    expect(within(grid).getByText('Founders Day')).toBeInTheDocument()
    expect(within(grid).getByText('Grace: Vacation leave')).toBeInTheDocument()
    expect(within(grid).getByText('Absent')).toBeInTheDocument()
    expect(grid.querySelector('[aria-current="date"]')).toHaveTextContent('Thursday, September 24')
  })

  it('asks for the month the URL names', async () => {
    nav.search = 'month=2026-12'
    render(<CalendarPanel />)

    await waitFor(() => expect(rpc.getCalendar).toHaveBeenCalledWith('2026-12', ''))
  })

  it('puts the next and previous month in the URL, and this month clears it', async () => {
    const user = userEvent.setup()
    nav.search = 'month=2026-09'
    rpc.getCalendar.mockResolvedValue({ ...month(), today: '2026-10-02' })
    render(<CalendarPanel />)

    await user.click(await screen.findByRole('button', { name: 'Next month' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/attendance/calendar?month=2026-10', {
      scroll: false,
    })

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/attendance/calendar?month=2026-08', {
      scroll: false,
    })

    await user.click(screen.getByRole('button', { name: 'This month' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/attendance/calendar', { scroll: false })
  })

  it('names the country of each holiday for an admin', async () => {
    rpc.getCalendar.mockResolvedValue(
      month({ '2026-09-02': { holidays: [{ name: 'Rizal Day', country: 'PH' }] } }, true),
    )
    render(<CalendarPanel />)

    const grid = await screen.findByRole('table', { name: 'September 2026' })
    expect(await within(grid).findByText('Rizal Day (Philippines)')).toBeInTheDocument()
    expect(screen.getByText(/Every holiday and everyone's leave/)).toBeInTheDocument()
  })

  it('folds a busy day into a count so the cell keeps its size', async () => {
    const leave = ['Ada', 'Grace', 'Linus', 'Margaret'].map((name, index) => ({
      userId: `user-${index}`,
      userName: name,
      name: 'Vacation leave',
    }))
    rpc.getCalendar.mockResolvedValue(month({ '2026-09-10': { leave } }, true))
    render(<CalendarPanel />)

    const grid = await screen.findByRole('table', { name: 'September 2026' })
    expect(within(grid).getByText('+1 more on leave')).toBeInTheDocument()
  })

  it('says what went wrong and offers a retry', async () => {
    const user = userEvent.setup()
    rpc.getCalendar.mockRejectedValueOnce(new Error('You are offline.'))
    render(<CalendarPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('You are offline.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table', { name: 'September 2026' })).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<CalendarPanel />)
    await screen.findByRole('table', { name: 'September 2026' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
