import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type {
  AttendanceDayRow,
  AttendanceSettingsRow,
  AttendanceShiftRow,
} from '@/features/attendance/schema'
import type { RunningTimerRow } from '@/features/tasks/schema'
import { ActivityButton } from './activity-button'

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

const tasksRpc = vi.hoisted(() => ({
  getRunningTimer: vi.fn(),
  stopTimer: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('@/features/attendance/rpc', () => rpc)
vi.mock('@/features/tasks/rpc', () => tasksRpc)
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
  sendReminders: true,
  holidayCountry: '',
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
    autoClosed: false,
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

const TIMER: RunningTimerRow = {
  entry: {
    id: 'entry-1',
    taskId: 'task-1',
    userId: 'user-1',
    userName: 'Grace',
    startedAt: new Date(Date.now() - 600_000).toISOString(),
    endedAt: undefined,
    seconds: 0,
    note: undefined,
    isRunning: true,
  },
  taskName: 'Stock count',
  taskNumber: 7,
  projectId: 'project-1',
}

// The header shows only the time; every action sits one tap away, inside the panel.
async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /on the clock|on break|task timer/i }))
  return screen.findByRole('dialog', { name: 'Time tracking' })
}

async function clockOutControl(user: ReturnType<typeof userEvent.setup>) {
  const panel = await openPanel(user)
  return within(panel).getByRole('button', { name: 'Clock out' })
}

describe('ActivityButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getTimeClock.mockResolvedValue(view(day()))
    rpc.clockOut.mockResolvedValue(day({ isOpen: false, clockOutAt: new Date().toISOString() }))
    tasksRpc.getRunningTimer.mockResolvedValue(null)
    tasksRpc.stopTimer.mockResolvedValue(undefined)
  })

  it('stays out of the header when nothing is running', async () => {
    rpc.getTimeClock.mockResolvedValue(view(undefined))
    render(<ActivityButton />)

    await waitFor(() => expect(tasksRpc.getRunningTimer).toHaveBeenCalled())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps the way out off the header and one tap away', async () => {
    const user = userEvent.setup()
    render(<ActivityButton />)

    expect(await screen.findByRole('button', { name: /on the clock/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clock out' })).not.toBeInTheDocument()
    expect(await clockOutControl(user)).toBeInTheDocument()
  })

  it('closes on Escape and hands focus back to the button', async () => {
    const user = userEvent.setup()
    render(<ActivityButton />)

    await openPanel(user)
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /on the clock/i })).toHaveFocus()
  })

  it('says so while the person is on a break', async () => {
    rpc.getTimeClock.mockResolvedValue(view(day({ onBreak: true })))
    render(<ActivityButton />)

    expect(await screen.findByRole('button', { name: /on break/i })).toBeInTheDocument()
  })

  it('reads hours and minutes in the header, not a ticking seconds count', async () => {
    render(<ActivityButton />)

    const button = await screen.findByRole('button', { name: /on the clock/i })
    expect(within(button).getByText(/^(0:59|1:00)$/)).toBeInTheDocument()
    expect(screen.queryByText(/\d:\d\d:\d\d/)).not.toBeInTheDocument()
  })

  it('counts the running break in words, not only in colour', async () => {
    const startedAt = new Date(Date.now() - 12 * 60_000).toISOString()
    rpc.getTimeClock.mockResolvedValue(
      view(
        day({
          onBreak: true,
          breaks: [{ id: 'b-1', startedAt, endedAt: undefined, seconds: 0, isRunning: true }],
        }),
      ),
    )
    render(<ActivityButton />)

    expect(await screen.findByText('Break 0:12')).toBeInTheDocument()
  })

  it('asks before it ends the day, and does nothing on its own', async () => {
    const user = userEvent.setup()
    render(<ActivityButton />)

    await user.click(await clockOutControl(user))

    expect(await screen.findByRole('dialog', { name: 'Clock out?' })).toBeInTheDocument()
    expect(rpc.clockOut).not.toHaveBeenCalled()
  })

  it('leaves the person on the clock when they back out', async () => {
    const user = userEvent.setup()
    render(<ActivityButton />)

    await user.click(await clockOutControl(user))
    await user.click(await screen.findByRole('button', { name: 'Stay on the clock' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpc.clockOut).not.toHaveBeenCalled()
  })

  it('clocks out once the confirmation is given', async () => {
    const user = userEvent.setup()
    render(<ActivityButton />)

    await user.click(await clockOutControl(user))
    const dialog = await screen.findByRole('dialog', { name: 'Clock out?' })
    await user.click(within(dialog).getByRole('button', { name: 'Clock out' }))

    await waitFor(() =>
      expect(rpc.clockOut).toHaveBeenCalledWith({ selfieKey: '', location: '', note: '' }),
    )
  })

  it('carries the note the company asks for', async () => {
    const user = userEvent.setup()
    rpc.getTimeClock.mockResolvedValue(view(day(), { ...SHIFT, requireNote: true }))
    render(<ActivityButton />)

    await user.click(await clockOutControl(user))
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

  it('shows a task timer alone and stops it from the panel', async () => {
    const user = userEvent.setup()
    rpc.getTimeClock.mockResolvedValue(view(undefined))
    tasksRpc.getRunningTimer.mockResolvedValue(TIMER)
    render(<ActivityButton />)

    const panel = await openPanel(user)
    expect(within(panel).getByRole('link', { name: '#7 Stock count' })).toHaveAttribute(
      'href',
      '/tasks?project=project-1&task=task-1&tab=time',
    )
    await user.click(within(panel).getByRole('button', { name: 'Stop timer' }))

    await waitFor(() => expect(tasksRpc.stopTimer).toHaveBeenCalled())
  })

  it('folds the day and a task timer into one button', async () => {
    const user = userEvent.setup()
    tasksRpc.getRunningTimer.mockResolvedValue(TIMER)
    render(<ActivityButton />)

    expect(
      await screen.findByRole('button', { name: /on the clock.*and a task timer/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)

    const panel = await openPanel(user)
    expect(within(panel).getByRole('button', { name: 'Clock out' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Stop timer' })).toBeInTheDocument()
  })

  it('has no accessibility violations, closed or open', async () => {
    const user = userEvent.setup()
    tasksRpc.getRunningTimer.mockResolvedValue(TIMER)
    const { container } = render(<ActivityButton />)

    await screen.findByRole('button', { name: /on the clock/i })
    expect(await axe(container)).toHaveNoViolations()

    await openPanel(user)
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
