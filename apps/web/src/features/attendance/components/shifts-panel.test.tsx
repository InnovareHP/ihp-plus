import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { DEFAULT_ATTENDANCE_SETTINGS, DEFAULT_SHIFT, type AttendanceShiftRow } from '../schema'
import { ShiftsPanel } from './shifts-panel'

const rpc = vi.hoisted(() => ({
  listShifts: vi.fn(),
  saveShift: vi.fn(),
  deleteShift: vi.fn(),
  listSchedules: vi.fn(),
  assignShift: vi.fn(),
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
  listHolidayCountries: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const MORNING: AttendanceShiftRow = {
  id: 'shift-1',
  name: 'Morning',
  shiftStartMinutes: 6 * 60,
  shiftEndMinutes: 15 * 60,
  graceMinutes: 10,
  workdays: '1,2,3,4,5',
  assignedCount: 4,
  requireSelfie: true,
  requireNote: false,
  captureLocation: false,
  autoClockOutHours: 16,
  sendReminders: true,
  holidayCountry: '',
  isDefault: false,
}

describe('ShiftsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listShifts.mockResolvedValue({
      shifts: [MORNING],
      settings: DEFAULT_ATTENDANCE_SETTINGS,
    })
    rpc.saveShift.mockResolvedValue(MORNING)
    rpc.deleteShift.mockResolvedValue(undefined)
    rpc.listHolidayCountries.mockResolvedValue([
      { code: 'PH', name: 'Philippines' },
      { code: 'US', name: 'United States of America' },
    ])
  })

  it('lists a shift by name, hours and how many people work it', async () => {
    render(<ShiftsPanel />)

    expect(await screen.findByText('Morning')).toBeInTheDocument()
    expect(screen.getByText('06:00–15:00')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('offers the first shift when the library is empty', async () => {
    rpc.listShifts.mockResolvedValue({ shifts: [], settings: DEFAULT_ATTENDANCE_SETTINGS })
    render(<ShiftsPanel />)

    expect(await screen.findByText('No shifts yet')).toBeInTheDocument()
  })

  it('writes a new shift from the company hours', async () => {
    const user = userEvent.setup()
    render(<ShiftsPanel />)

    await user.click(await screen.findByRole('button', { name: 'New shift' }))
    const dialog = await screen.findByRole('dialog', { name: 'New shift' })

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Graveyard')
    await user.click(within(dialog).getByRole('button', { name: 'Save shift' }))

    await waitFor(() =>
      expect(rpc.saveShift).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Graveyard',
          shiftStartMinutes: DEFAULT_SHIFT.shiftStartMinutes,
        }),
      ),
    )
  })

  it('turns email reminders off for a shift that should not get them', async () => {
    const user = userEvent.setup()
    render(<ShiftsPanel />)

    await user.click(await screen.findByRole('button', { name: 'New shift' }))
    const dialog = await screen.findByRole('dialog', { name: 'New shift' })

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Remote')
    const reminders = within(dialog).getByRole('switch', { name: /Email reminders/ })
    expect(reminders).toBeChecked()
    await user.click(reminders)
    await user.click(within(dialog).getByRole('button', { name: 'Save shift' }))

    await waitFor(() =>
      expect(rpc.saveShift).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Remote', sendReminders: false }),
      ),
    )
  })

  it('ties a shift to a country’s public holidays', async () => {
    const user = userEvent.setup()
    render(<ShiftsPanel />)

    await user.click(await screen.findByRole('button', { name: 'New shift' }))
    const dialog = await screen.findByRole('dialog', { name: 'New shift' })

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Manila day')
    const country = within(dialog).getByRole('combobox', { name: /Public holidays/ })
    expect(country).toHaveValue('None — company days off only')
    await user.click(country)
    await user.click(await screen.findByRole('option', { name: 'Philippines' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save shift' }))

    await waitFor(() =>
      expect(rpc.saveShift).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Manila day', holidayCountry: 'PH' }),
      ),
    )
  })

  it('will not save a shift with no name', async () => {
    const user = userEvent.setup()
    render(<ShiftsPanel />)

    await user.click(await screen.findByRole('button', { name: 'New shift' }))
    const dialog = await screen.findByRole('dialog', { name: 'New shift' })
    await user.click(within(dialog).getByRole('button', { name: 'Save shift' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Give the shift a name people will recognise.',
    )
    expect(rpc.saveShift).not.toHaveBeenCalled()
  })

  it('says why a shift people work cannot be deleted', async () => {
    const user = userEvent.setup()
    rpc.deleteShift.mockRejectedValue(
      new Error('People still work that shift — move them to another one first.'),
    )
    render(<ShiftsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Actions for Morning' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'People still work that shift — move them to another one first.',
        }),
      ),
    )
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<ShiftsPanel />)

    await screen.findByText('Morning')
    expect(await axe(container)).toHaveNoViolations()
  })
})
