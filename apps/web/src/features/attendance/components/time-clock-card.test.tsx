import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { AttendanceDayRow, AttendanceSettingsRow, AttendanceShiftRow } from '../schema'
import { TimeClockCard } from './time-clock-card'

const rpc = vi.hoisted(() => ({
  getTimeClock: vi.fn(),
  getAttendanceSettings: vi.fn(),
  updateAttendanceSettings: vi.fn(),
  listAttendance: vi.fn(),
  clockIn: vi.fn(),
  clockOut: vi.fn(),
  startBreak: vi.fn(),
  endBreak: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const RULES: AttendanceSettingsRow = {
  timeZone: 'UTC',
  defaultShiftId: 'shift-1',
}

const SHIFT: AttendanceShiftRow = {
  id: 'shift-1',
  name: 'Company hours',
  shiftStartMinutes: 9 * 60,
  shiftEndMinutes: 18 * 60,
  graceMinutes: 15,
  workdays: '1,2,3,4,5',
  assignedCount: 0,
  requireSelfie: false,
  requireNote: false,
  captureLocation: false,
  autoClockOutHours: 16,
  isDefault: true,
}

const SCHEDULE = {
  userId: 'user-1',
  userName: 'Grace',
  shiftStartMinutes: 9 * 60,
  shiftEndMinutes: 18 * 60,
  graceMinutes: 15,
  workdays: '1,2,3,4,5',
  isDefault: true,
}

function day(overrides: Partial<AttendanceDayRow> = {}): AttendanceDayRow {
  return {
    id: 'day-1',
    userId: 'user-1',
    userName: 'Grace',
    workDate: '2026-09-22',
    clockInAt: new Date(Date.now() - 3600_000).toISOString(),
    clockOutAt: undefined,
    workedSeconds: 0,
    breakSeconds: 0,
    lateSeconds: 0,
    status: 'open',
    source: 'clock',
    note: undefined,
    clockInSelfieUrl: undefined,
    clockOutSelfieUrl: undefined,
    clockInLocation: undefined,
    clockOutLocation: undefined,
    isOpen: true,
    onBreak: false,
    breaks: [],
    ...overrides,
  }
}

// jsdom has no camera; a stub is what tells the panel one is there at all.
function withCamera(available: boolean) {
  const getUserMedia = available
    ? vi.fn().mockResolvedValue({ getTracks: () => [] })
    : vi.fn().mockRejectedValue(new Error('denied'))

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })

  return getUserMedia
}

function view(today: AttendanceDayRow | undefined, shift: AttendanceShiftRow = SHIFT) {
  return { today, settings: RULES, schedule: SCHEDULE, canManage: false, shift }
}

describe('TimeClockCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getTimeClock.mockResolvedValue(view(undefined))
    rpc.clockIn.mockResolvedValue(day())
    rpc.clockOut.mockResolvedValue(day({ isOpen: false, clockOutAt: new Date().toISOString() }))
    rpc.startBreak.mockResolvedValue(day({ onBreak: true }))
    rpc.endBreak.mockResolvedValue(day())
  })

  it('offers the one action a day that has not started needs', async () => {
    render(<TimeClockCard />)

    expect(await screen.findByRole('button', { name: 'Clock in' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clock out' })).not.toBeInTheDocument()
  })

  it('clocks in and asks for no photo when the company does not', async () => {
    const user = userEvent.setup()
    render(<TimeClockCard />)

    await user.click(await screen.findByRole('button', { name: 'Clock in' }))

    await waitFor(() =>
      expect(rpc.clockIn).toHaveBeenCalledWith({ selfieKey: '', location: '', note: '' }),
    )
  })

  it('puts the camera in front of the punch when a selfie is required', async () => {
    const user = userEvent.setup()
    withCamera(true)
    rpc.getTimeClock.mockResolvedValue(view(undefined, { ...SHIFT, requireSelfie: true }))
    render(<TimeClockCard />)

    await user.click(await screen.findByRole('button', { name: 'Clock in' }))

    expect(await screen.findByRole('button', { name: 'Take photo' })).toBeInTheDocument()
    expect(rpc.clockIn).not.toHaveBeenCalled()
  })

  it('offers a photo to pick when the camera will not open, rather than locking the day out', async () => {
    const user = userEvent.setup()
    withCamera(false)
    rpc.getTimeClock.mockResolvedValue(view(undefined, { ...SHIFT, requireSelfie: true }))
    render(<TimeClockCard />)

    await user.click(await screen.findByRole('button', { name: 'Clock in' }))

    expect(await screen.findByRole('button', { name: 'Choose a photo' })).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This browser will not open the camera',
    )
  })

  it('offers a break and a way out while the clock runs', async () => {
    rpc.getTimeClock.mockResolvedValue(view(day()))
    render(<TimeClockCard />)

    expect(await screen.findByRole('button', { name: 'Start break' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clock out' })).toBeInTheDocument()
  })

  it('offers only the way back from a break', async () => {
    rpc.getTimeClock.mockResolvedValue(
      view(
        day({
          onBreak: true,
          breaks: [
            {
              id: 'break-1',
              startedAt: new Date(Date.now() - 600_000).toISOString(),
              endedAt: undefined,
              seconds: 0,
              isRunning: true,
            },
          ],
        }),
      ),
    )
    render(<TimeClockCard />)

    expect(await screen.findByRole('button', { name: 'End break' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clock out' })).not.toBeInTheDocument()
  })

  it('will not close the day without the note the company asks for', async () => {
    const user = userEvent.setup()
    rpc.getTimeClock.mockResolvedValue(view(day(), { ...SHIFT, requireNote: true }))
    render(<TimeClockCard />)

    await user.click(await screen.findByRole('button', { name: 'Clock out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Say what you worked on before clocking out.',
    )
    expect(rpc.clockOut).not.toHaveBeenCalled()
  })

  it('says what a failure was, out loud', async () => {
    const user = userEvent.setup()
    rpc.clockIn.mockRejectedValue(new Error('You are already clocked in.'))
    render(<TimeClockCard />)

    await user.click(await screen.findByRole('button', { name: 'Clock in' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'You are already clocked in.' }),
      ),
    )
  })

  it('reads the hours back once the day is closed', async () => {
    rpc.getTimeClock.mockResolvedValue(
      view(
        day({
          isOpen: false,
          clockOutAt: new Date().toISOString(),
          workedSeconds: 8 * 3600,
          status: 'recorded',
        }),
      ),
    )
    render(<TimeClockCard />)

    expect(await screen.findByText(/8h worked/)).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    rpc.getTimeClock.mockResolvedValue(view(day()))
    const { container } = render(<TimeClockCard />)

    await screen.findByRole('button', { name: 'Clock out' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
