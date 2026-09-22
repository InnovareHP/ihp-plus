import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/render'
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
  saveAttendanceDay: vi.fn(),
  approveAttendanceDay: vi.fn(),
  deleteAttendanceDay: vi.fn(),
  saveSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
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
  approvedByName: undefined,
}

describe('TeamTimesheetPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listAttendance.mockResolvedValue({
      days: [DAY],
      totalWorkedSeconds: 8 * 3600,
      totalBreakSeconds: 3600,
      totalLateSeconds: 0,
    })
    rpc.listSchedules.mockResolvedValue({ schedules: [], settings: { timeZone: 'Asia/Manila' } })
    rpc.approveAttendanceDay.mockResolvedValue({ ...DAY, status: 'approved' })
    rpc.deleteAttendanceDay.mockResolvedValue(undefined)
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

    await user.click(await screen.findByRole('button', { name: /^Remove Grace Reyes/ }))

    await waitFor(() => expect(screen.queryByText('09:05')).not.toBeInTheDocument())
    expect(undo.offerUndo).toHaveBeenCalled()
    // Nothing is deleted until the toast closes on its own.
    expect(rpc.deleteAttendanceDay).not.toHaveBeenCalled()
  })

  it('puts the row back where it was when the undo is taken', async () => {
    const user = userEvent.setup()
    render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

    await user.click(await screen.findByRole('button', { name: /^Remove Grace Reyes/ }))
    await waitFor(() => expect(screen.queryByText('09:05')).not.toBeInTheDocument())

    undo.offerUndo.mock.calls[0]?.[0]?.onUndo()

    expect(await screen.findByText('09:05')).toBeInTheDocument()
    expect(rpc.deleteAttendanceDay).not.toHaveBeenCalled()
  })

  it('deletes only once the undo window closes', async () => {
    const user = userEvent.setup()
    render(<TeamTimesheetPanel timeZone="Asia/Manila" />)

    await user.click(await screen.findByRole('button', { name: /^Remove Grace Reyes/ }))
    undo.offerUndo.mock.calls[0]?.[0]?.onCommit()

    await waitFor(() => expect(rpc.deleteAttendanceDay).toHaveBeenCalledWith('day-1'))
  })

  it('moves the badge on the click, before the server answers', async () => {
    const user = userEvent.setup()
    let settle: (day: AttendanceDayRow) => void = () => {}
    rpc.approveAttendanceDay.mockReturnValue(
      new Promise<AttendanceDayRow>((resolve) => {
        settle = resolve
      }),
    )

    render(<TeamTimesheetPanel timeZone="Asia/Manila" />)
    await user.click(await screen.findByRole('button', { name: /^Approve Grace Reyes/ }))

    expect(await screen.findByText('Approved')).toBeInTheDocument()
    settle({ ...DAY, status: 'approved' })
  })

  it('puts the badge back and says why when the sign-off fails', async () => {
    const user = userEvent.setup()
    rpc.approveAttendanceDay.mockRejectedValue(new Error('Only an admin signs off attendance.'))

    render(<TeamTimesheetPanel timeZone="Asia/Manila" />)
    await user.click(await screen.findByRole('button', { name: /^Approve Grace Reyes/ }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only an admin signs off attendance.' }),
      ),
    )
    expect(await screen.findByText('Recorded')).toBeInTheDocument()
  })
})
