import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { CalendarMonth, TeamCalendarDayRow, TeamCalendarMonth } from '../schema'
import { datesOfMonth } from '../utils/calendar'
import { TeamCalendarPanel } from './team-calendar-panel'

const rpc = vi.hoisted(() => ({
  getTeamCalendar: vi.fn(),
  getCalendar: vi.fn(),
  listSchedules: vi.fn(),
  listHolidayCountries: vi.fn(),
}))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/attendance/team',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

function team(overrides: Record<string, Partial<TeamCalendarDayRow>> = {}): TeamCalendarMonth {
  return {
    month: '2026-09',
    today: '2026-09-24',
    timeZone: 'Asia/Manila',
    days: datesOfMonth('2026-09').map((date) => ({
      date,
      holidays: [],
      people: [],
      ...overrides[date],
    })),
  }
}

const BUSY_DAY: Partial<TeamCalendarDayRow> = {
  people: [
    {
      userId: 'u-1',
      userName: 'Grace',
      state: 'worked',
      workedSeconds: 8 * 3600,
      leaveName: undefined,
    },
    { userId: 'u-2', userName: 'Linus', state: 'open', workedSeconds: 0, leaveName: undefined },
    { userId: 'u-3', userName: 'Ada', state: 'absent', workedSeconds: 0, leaveName: undefined },
    {
      userId: 'u-4',
      userName: 'Margaret',
      state: 'leave',
      workedSeconds: 0,
      leaveName: 'Sick leave',
    },
  ],
}

describe('TeamCalendarPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.search = ''
    rpc.listHolidayCountries.mockResolvedValue([{ code: 'PH', name: 'Philippines' }])
    rpc.listSchedules.mockResolvedValue({
      schedules: [{ userId: 'u-3', userName: 'Ada' }],
      settings: { timeZone: 'Asia/Manila', defaultShiftId: '' },
      shifts: [],
    })
    rpc.getTeamCalendar.mockResolvedValue(
      team({
        '2026-09-22': BUSY_DAY,
        '2026-09-23': { holidays: [{ name: 'Rizal Day', country: 'PH' }] },
      }),
    )
  })

  it('counts each day for the whole team', async () => {
    render(<TeamCalendarPanel />)

    const grid = await screen.findByRole('table', { name: 'September 2026' })
    expect(within(grid).getByText('2 in')).toBeInTheDocument()
    expect(within(grid).getByText('1 absent')).toBeInTheDocument()
    expect(within(grid).getByText('1 on leave')).toBeInTheDocument()
    expect(within(grid).getByText('Rizal Day (Philippines)')).toBeInTheDocument()
    expect(rpc.getCalendar).not.toHaveBeenCalled()
  })

  it('opens the names behind a day, with the board a click away', async () => {
    const user = userEvent.setup()
    render(<TeamCalendarPanel />)

    const grid = await screen.findByRole('table', { name: 'September 2026' })
    await user.click(
      within(grid).getByRole('button', {
        name: 'Who was in on Tuesday, September 22: 2 in, 1 absent, 1 on leave',
      }),
    )

    const dialog = await screen.findByRole('dialog', { name: 'Tuesday, September 22, 2026' })
    expect(within(dialog).getByText('In (2)')).toBeInTheDocument()
    expect(within(dialog).getByText('Grace')).toBeInTheDocument()
    expect(within(dialog).getByText(/still clocked in/)).toBeInTheDocument()
    expect(within(dialog).getByText('Absent (1)')).toBeInTheDocument()
    expect(within(dialog).getByText(/Sick leave/)).toBeInTheDocument()
    expect(
      within(dialog).getByRole('link', { name: 'Open this day on the board' }),
    ).toHaveAttribute('href', '/attendance/team?to=2026-09-22')
  })

  it('switches to one employee’s month when one is picked, and keeps it in the URL', async () => {
    const user = userEvent.setup()
    render(<TeamCalendarPanel />)

    await user.click(await screen.findByRole('combobox', { name: 'Employee' }))
    await user.click(await screen.findByRole('option', { name: 'Ada' }))

    expect(nav.replace).toHaveBeenLastCalledWith('/attendance/team?user=u-3', { scroll: false })
  })

  it('reads that employee’s own days when the URL names them', async () => {
    nav.search = 'user=u-3&month=2026-09'
    rpc.getCalendar.mockResolvedValue({
      month: '2026-09',
      today: '2026-09-24',
      timeZone: 'Asia/Manila',
      canManage: true,
      showsEveryone: false,
      days: datesOfMonth('2026-09').map((date) => ({
        date,
        state: date === '2026-09-22' ? 'absent' : 'scheduled',
        workedSeconds: 0,
        holidays: [],
        leave: [],
      })),
    } satisfies CalendarMonth)
    render(<TeamCalendarPanel />)

    const grid = await screen.findByRole('table', { name: 'September 2026' })
    expect(rpc.getCalendar).toHaveBeenCalledWith('2026-09', 'u-3')
    expect(rpc.getTeamCalendar).not.toHaveBeenCalled()
    expect(within(grid).getByText('Absent')).toBeInTheDocument()
    expect(await screen.findByText("Ada's days, holidays and approved leave.")).toBeInTheDocument()
  })

  it('says what went wrong and offers a retry', async () => {
    rpc.getTeamCalendar.mockRejectedValueOnce(new Error('You do not have permission.'))
    const user = userEvent.setup()
    render(<TeamCalendarPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(rpc.getTeamCalendar).toHaveBeenCalledTimes(2))
  })

  it('has no axe violations', async () => {
    const { container } = render(<TeamCalendarPanel />)
    await screen.findByRole('table', { name: 'September 2026' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
