import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { AttendanceDayRow } from '../schema'
import { TeamTimesheetPanel } from './team-timesheet-panel'

const rpc = vi.hoisted(() => ({
  getTimeClock: vi.fn(),
  getAttendanceSettings: vi.fn(),
  updateAttendanceSettings: vi.fn(),
  listAttendance: vi.fn(),
  clockIn: vi.fn(),
  clockOut: vi.fn(),
  startBreak: vi.fn(),
  endBreak: vi.fn(),
  getAttendanceBoard: vi.fn(),
  listSchedules: vi.fn(),
  listCorrections: vi.fn(async () => []),
  saveAttendanceDay: vi.fn(),
  deleteAttendanceDay: vi.fn(),
  listShifts: vi.fn(),
  saveShift: vi.fn(),
  deleteShift: vi.fn(),
  assignShift: vi.fn(),
  grantDayOff: vi.fn(),
  revokeDayOff: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))
const undo = vi.hoisted(() => ({ offerUndo: vi.fn(), UNDO_WINDOW_MS: 8000 }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: toast }))
vi.mock('@/lib/undo', () => undo)
vi.mock('next/navigation', () => ({
  usePathname: () => '/attendance/team',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('from=2026-09-01&to=2026-09-22'),
}))

const DAY: AttendanceDayRow = {
  id: 'day-1',
  userId: 'user-1',
  userName: 'Grace Reyes',
  workDate: '2026-09-22',
  clockInAt: '2026-09-22T01:05:00.000Z',
  clockOutAt: '2026-09-22T10:05:00.000Z',
  workedSeconds: 8 * 3600,
  breakSeconds: 3600,
  lateSeconds: 0,
  status: 'recorded',
  source: 'clock',
  note: undefined,
  clockInSelfieUrl: undefined,
  clockOutSelfieUrl: undefined,
  clockInLocation: undefined,
  clockOutLocation: undefined,
  isOpen: false,
  onBreak: false,
  breaks: [],
  autoClosed: false,
}

describe('TeamTimesheetPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listAttendance.mockResolvedValue({
      days: [DAY],
      totalWorkedSeconds: 8 * 3600,
      totalBreakSeconds: 3600,
      totalLateSeconds: 0,
      absences: [],
    })
    rpc.listSchedules.mockResolvedValue({
      schedules: [],
      settings: { timeZone: 'Asia/Manila', defaultShiftId: '' },
      shifts: [],
    })
    rpc.deleteAttendanceDay.mockResolvedValue(undefined)
  })

  it('lists the scheduled days nobody clocked, and a missed clock-out on its row', async () => {
    rpc.listAttendance.mockResolvedValue({
      days: [{ ...DAY, autoClosed: true }],
      totalWorkedSeconds: 8 * 3600,
      totalBreakSeconds: 3600,
      totalLateSeconds: 0,
      absences: [
        {
          userId: 'user-2',
          userName: 'Ada Lovelace',
          workDate: '2026-09-21',
          kind: 'absent',
          leaveName: undefined,
          granted: false,
        },
        {
          userId: 'user-2',
          userName: 'Ada Lovelace',
          workDate: '2026-09-18',
          kind: 'leave',
          leaveName: 'Vacation leave',
          granted: false,
        },
      ],
    })
    render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

    const table = await screen.findByRole('table', { name: 'Days not clocked' })
    expect(within(table).getByText('Absent')).toBeInTheDocument()
    expect(within(table).getByText('On leave: Vacation leave')).toBeInTheDocument()
    expect(screen.getByText(/1 absent, 1 on leave/)).toBeInTheDocument()
    expect(screen.getByText('Missed clock-out')).toBeInTheDocument()
  })

  it('says so when every scheduled day was clocked', async () => {
    render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

    expect(await screen.findByText('No missed days')).toBeInTheDocument()
  })

  it('reads the times in the company zone, not the browser one', async () => {
    render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

    // 01:05 UTC is 09:05 in Manila; a browser in any zone must read the same row.
    expect(await screen.findByText('09:05')).toBeInTheDocument()
    expect(screen.getByText('18:05')).toBeInTheDocument()
  })

  it('takes the row away as it offers the undo, not when the server answers', async () => {
    const user = userEvent.setup()
    render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

    await user.click(await screen.findByRole('button', { name: /^Actions for Grace Reyes/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }))

    await waitFor(() => expect(screen.queryByText('09:05')).not.toBeInTheDocument())
    expect(undo.offerUndo).toHaveBeenCalled()
    // Nothing is deleted until the toast closes on its own.
    expect(rpc.deleteAttendanceDay).not.toHaveBeenCalled()
  })

  it('puts the row back where it was when the undo is taken', async () => {
    const user = userEvent.setup()
    render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

    await user.click(await screen.findByRole('button', { name: /^Actions for Grace Reyes/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }))
    await waitFor(() => expect(screen.queryByText('09:05')).not.toBeInTheDocument())

    undo.offerUndo.mock.calls[0]?.[0]?.onUndo()

    expect(await screen.findByText('09:05')).toBeInTheDocument()
    expect(rpc.deleteAttendanceDay).not.toHaveBeenCalled()
  })

  it('deletes only once the undo window closes', async () => {
    const user = userEvent.setup()
    render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

    await user.click(await screen.findByRole('button', { name: /^Actions for Grace Reyes/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }))
    undo.offerUndo.mock.calls[0]?.[0]?.onCommit()

    await waitFor(() => expect(rpc.deleteAttendanceDay).toHaveBeenCalledWith('day-1'))
  })

  it('says how the row was recorded, with nothing to sign off', async () => {
    render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

    expect(await screen.findByText('Recorded')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument()
  })
  describe('granting a day off', () => {
    const ABSENT = {
      userId: 'user-2',
      userName: 'Ada Lovelace',
      workDate: '2026-09-21',
      kind: 'absent' as const,
      leaveName: undefined,
      granted: false,
    }

    function withAbsences(absences: unknown[]) {
      rpc.listAttendance.mockResolvedValue({
        days: [],
        totalWorkedSeconds: 0,
        totalBreakSeconds: 0,
        totalLateSeconds: 0,
        absences,
      })
    }

    it('turns the absent row into paid leave before the server answers', async () => {
      withAbsences([ABSENT])
      rpc.grantDayOff.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      const { container } = render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

      const table = await screen.findByRole('table', { name: 'Days not clocked' })
      await user.click(
        within(table).getByRole('button', {
          name: 'Grant day off to Ada Lovelace on 2026-09-21',
        }),
      )
      await user.click(await screen.findByRole('menuitem', { name: 'Paid day off' }))

      expect(await within(table).findByText('On leave: Paid day off')).toBeInTheDocument()
      expect(within(table).queryByText('Absent')).not.toBeInTheDocument()
      expect(rpc.grantDayOff).toHaveBeenCalledWith({
        userId: 'user-2',
        workDate: '2026-09-21',
        paid: true,
      })
      expect(await axe(container)).toHaveNoViolations()
    })

    it('grants an unpaid day off from the keyboard', async () => {
      withAbsences([ABSENT])
      rpc.grantDayOff.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

      const table = await screen.findByRole('table', { name: 'Days not clocked' })
      within(table)
        .getByRole('button', { name: /^Grant day off/ })
        .focus()
      await user.keyboard('{Enter}')
      const unpaid = await screen.findByRole('menuitem', { name: 'Unpaid day off' })
      unpaid.focus()
      await user.keyboard('{Enter}')

      expect(await within(table).findByText('On leave: Unpaid day off')).toBeInTheDocument()
      expect(rpc.grantDayOff).toHaveBeenCalledWith({
        userId: 'user-2',
        workDate: '2026-09-21',
        paid: false,
      })
    })

    it('puts the row back to absent and says why when the grant fails', async () => {
      withAbsences([ABSENT])
      rpc.grantDayOff.mockRejectedValue(new Error('2026-09-21 is already Vacation leave.'))
      const user = userEvent.setup()
      render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

      const table = await screen.findByRole('table', { name: 'Days not clocked' })
      await user.click(within(table).getByRole('button', { name: /^Grant day off/ }))
      await user.click(await screen.findByRole('menuitem', { name: 'Paid day off' }))

      await waitFor(() =>
        expect(toast.show).toHaveBeenCalledWith(
          expect.objectContaining({ message: '2026-09-21 is already Vacation leave.' }),
        ),
      )
      expect(await within(table).findByText('Absent')).toBeInTheDocument()
    })

    it('takes back a granted day behind an undo, and only then tells the server', async () => {
      withAbsences([{ ...ABSENT, kind: 'leave', leaveName: 'Paid day off', granted: true }])
      rpc.revokeDayOff.mockResolvedValue(undefined)
      const user = userEvent.setup()
      render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

      const table = await screen.findByRole('table', { name: 'Days not clocked' })
      await user.click(within(table).getByRole('button', { name: /^Take back the day off/ }))

      expect(await within(table).findByText('Absent')).toBeInTheDocument()
      expect(rpc.revokeDayOff).not.toHaveBeenCalled()

      undo.offerUndo.mock.calls[0]?.[0]?.onCommit()
      await waitFor(() =>
        expect(rpc.revokeDayOff).toHaveBeenCalledWith({ userId: 'user-2', workDate: '2026-09-21' }),
      )
    })

    it('offers nothing on leave that came from an approved request', async () => {
      withAbsences([{ ...ABSENT, kind: 'leave', leaveName: 'Vacation leave', granted: false }])
      render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

      const table = await screen.findByRole('table', { name: 'Days not clocked' })
      expect(within(table).queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
