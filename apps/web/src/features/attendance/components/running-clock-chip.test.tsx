import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { AttendanceDayRow, AttendanceSettingsRow, AttendanceShiftRow } from '../schema'
import { RunningClockChip } from './running-clock-chip'

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

function view(today: AttendanceDayRow | undefined, shift: AttendanceShiftRow = SHIFT) {
  return {
    today,
    settings: RULES,
    shift,
    schedule: {
      userId: 'user-1',
      userName: 'Grace',
      shiftStartMinutes: 540,
      shiftEndMinutes: 1080,
      graceMinutes: 15,
      workdays: '1,2,3,4,5',
      isDefault: true,
    },
    canManage: false,
  }
}

// Mantine's visibleFrom/hiddenFrom is CSS, so both the chip's icon and the narrow-screen button
// are in the DOM under test; a reader only ever meets one of them.
async function clockOutControl() {
  const controls = await screen.findAllByRole('button', { name: 'Clock out' })
  return controls[0] as HTMLElement
}

describe('RunningClockChip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getTimeClock.mockResolvedValue(view(day()))
    rpc.clockOut.mockResolvedValue(day({ isOpen: false, clockOutAt: new Date().toISOString() }))
  })

  it('stays out of the header when no day is running', async () => {
    rpc.getTimeClock.mockResolvedValue(view(undefined))
    render(<RunningClockChip />)

    await waitFor(() => expect(rpc.getTimeClock).toHaveBeenCalled())
    expect(screen.queryAllByRole('button', { name: 'Clock out' })).toHaveLength(0)
  })

  it('says the day is running and offers the way out', async () => {
    render(<RunningClockChip />)

    expect(await screen.findByText('On the clock')).toBeInTheDocument()
    expect(await clockOutControl()).toBeInTheDocument()
  })

  it('says so while the person is on a break', async () => {
    rpc.getTimeClock.mockResolvedValue(view(day({ onBreak: true })))
    render(<RunningClockChip />)

    expect(await screen.findByText('On break')).toBeInTheDocument()
  })

  it('asks before it ends the day, and does nothing on its own', async () => {
    const user = userEvent.setup()
    render(<RunningClockChip />)

    await user.click(await clockOutControl())

    expect(await screen.findByRole('dialog', { name: 'Clock out?' })).toBeInTheDocument()
    expect(rpc.clockOut).not.toHaveBeenCalled()
  })

  it('leaves the person on the clock when they back out', async () => {
    const user = userEvent.setup()
    render(<RunningClockChip />)

    await user.click(await clockOutControl())
    await user.click(await screen.findByRole('button', { name: 'Stay on the clock' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpc.clockOut).not.toHaveBeenCalled()
  })

  it('clocks out once the confirmation is given', async () => {
    const user = userEvent.setup()
    render(<RunningClockChip />)

    await user.click(await clockOutControl())
    const dialog = await screen.findByRole('dialog', { name: 'Clock out?' })
    await user.click(within(dialog).getByRole('button', { name: 'Clock out' }))

    await waitFor(() =>
      expect(rpc.clockOut).toHaveBeenCalledWith({ selfieKey: '', location: '', note: '' }),
    )
  })

  it('carries the note the company asks for', async () => {
    const user = userEvent.setup()
    rpc.getTimeClock.mockResolvedValue(view(day(), { ...SHIFT, requireNote: true }))
    render(<RunningClockChip />)

    await user.click(await clockOutControl())
    const dialog = await screen.findByRole('dialog', { name: 'Clock out?' })

    await user.click(within(dialog).getByRole('button', { name: 'Clock out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Say what you worked on before clocking out.',
    )

    await user.type(within(dialog).getByLabelText(/What did you work on/), 'Stock count')
    await user.click(within(dialog).getByRole('button', { name: 'Clock out' }))

    await waitFor(() =>
      expect(rpc.clockOut).toHaveBeenCalledWith({
        selfieKey: '',
        location: '',
        note: 'Stock count',
      }),
    )
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<RunningClockChip />)

    await screen.findByText('On the clock')
    expect(await axe(container)).toHaveNoViolations()
  })
})
