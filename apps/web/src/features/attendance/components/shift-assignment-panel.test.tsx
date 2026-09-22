import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { DEFAULT_ATTENDANCE_SETTINGS, type AttendanceScheduleRow } from '../schema'
import { ShiftAssignmentPanel } from './shift-assignment-panel'

const rpc = vi.hoisted(() => ({
  listSchedules: vi.fn(),
  assignShift: vi.fn(),
  listShifts: vi.fn(),
  saveShift: vi.fn(),
  deleteShift: vi.fn(),
  getAttendanceBoard: vi.fn(),
  saveAttendanceDay: vi.fn(),
  deleteAttendanceDay: vi.fn(),
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

const ON_DEFAULT: AttendanceScheduleRow = {
  userId: 'user-1',
  userName: 'Grace Reyes',
  jobTitle: 'Nurse',
  shiftStartMinutes: 9 * 60,
  shiftEndMinutes: 18 * 60,
  graceMinutes: 15,
  workdays: '1,2,3,4,5',
  isDefault: true,
  shiftId: undefined,
  shiftName: undefined,
}

const MORNING = {
  id: 'shift-1',
  name: 'Morning',
  shiftStartMinutes: 6 * 60,
  shiftEndMinutes: 15 * 60,
  graceMinutes: 10,
  workdays: '1,2,3,4,5',
  assignedCount: 2,
}

// Mantine's Select carries a hidden input holding the value beside the one people click.
async function shiftPicker() {
  const inputs = await screen.findAllByLabelText('Shift for Grace Reyes')
  return inputs.find((input) => input.getAttribute('type') !== 'hidden') as HTMLElement
}

describe('ShiftAssignmentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listSchedules.mockResolvedValue({
      schedules: [ON_DEFAULT],
      settings: DEFAULT_ATTENDANCE_SETTINGS,
      shifts: [MORNING],
    })
    rpc.assignShift.mockResolvedValue({ ...ON_DEFAULT, isDefault: false, shiftId: 'shift-1' })
  })

  it('says who is on the company hours and who is on a shift', async () => {
    render(<ShiftAssignmentPanel />)

    expect(await screen.findByText('Grace Reyes')).toBeInTheDocument()
    // The badge beside the hours, not the option of the same name inside the picker.
    expect(screen.getAllByText('Company hours').length).toBeGreaterThan(0)
  })

  it('assigns the shift picked for that person', async () => {
    const user = userEvent.setup()
    render(<ShiftAssignmentPanel />)

    await user.click(await shiftPicker())
    await user.click(await screen.findByRole('option', { name: /Morning/ }))

    await waitFor(() =>
      expect(rpc.assignShift).toHaveBeenCalledWith({ userId: 'user-1', shiftId: 'shift-1' }),
    )
  })

  it('points at the time clock for writing the shifts themselves', async () => {
    render(<ShiftAssignmentPanel />)

    const link = await screen.findByRole('link', { name: 'Time clock → Shifts' })
    expect(link).toHaveAttribute('href', '/attendance/team?tab=shifts')
  })

  it('says why an assignment failed', async () => {
    const user = userEvent.setup()
    rpc.assignShift.mockRejectedValue(new Error('Only an admin sets shifts.'))
    render(<ShiftAssignmentPanel />)

    await user.click(await shiftPicker())
    await user.click(await screen.findByRole('option', { name: /Morning/ }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only an admin sets shifts.' }),
      ),
    )
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<ShiftAssignmentPanel />)

    await screen.findByText('Grace Reyes')
    expect(await axe(container)).toHaveNoViolations()
  })
})
