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
  listHolidays: vi.fn(),
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
    rpc.updateAttendanceSettings.mockImplementation(async (settings) => settings)
    rpc.listHolidays.mockResolvedValue({
      holidays: [
        {
          id: 'h-1',
          date: `${new Date().getFullYear()}-03-01`,
          name: 'Founders Day',
          country: '',
          imported: false,
        },
      ],
      canManage: true,
    })
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

  it('leaves the company settings alone when neither was touched', async () => {
    const user = userEvent.setup()
    render(<ShiftsPanel />)

    await user.click(await screen.findByRole('button', { name: 'New shift' }))
    const dialog = await screen.findByRole('dialog', { name: 'New shift' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Mid')
    await user.click(within(dialog).getByRole('button', { name: 'Save shift' }))

    await waitFor(() => expect(rpc.saveShift).toHaveBeenCalled())
    expect(rpc.updateAttendanceSettings).not.toHaveBeenCalled()
  })

  it('saves the company time zone and makes the saved shift the company hours', async () => {
    const user = userEvent.setup()
    render(<ShiftsPanel />)

    await user.click(await screen.findByRole('button', { name: 'New shift' }))
    const dialog = await screen.findByRole('dialog', { name: 'New shift' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Morning')

    const zone = within(dialog).getByRole('combobox', { name: /Company time zone/ })
    await user.clear(zone)
    await user.type(zone, 'Asia/Manila')
    await user.click(await screen.findByRole('option', { name: 'Asia/Manila' }))
    await user.click(within(dialog).getByRole('switch', { name: /Make this the company hours/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Save shift' }))

    // The id comes from the saved shift, so a brand-new shift can become the default in one go.
    await waitFor(() =>
      expect(rpc.updateAttendanceSettings).toHaveBeenCalledWith({
        timeZone: 'Asia/Manila',
        defaultShiftId: 'shift-1',
      }),
    )
  })

  it('keeps the modal open and updates, not duplicates, the shift when the settings fail', async () => {
    rpc.updateAttendanceSettings.mockRejectedValue(new Error('Only an admin sets the rules.'))
    const user = userEvent.setup()
    render(<ShiftsPanel />)

    await user.click(await screen.findByRole('button', { name: 'New shift' }))
    const dialog = await screen.findByRole('dialog', { name: 'New shift' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Morning')
    await user.click(within(dialog).getByRole('switch', { name: /Make this the company hours/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Save shift' }))

    expect(
      await within(dialog).findByText(/The shift was saved, but the company settings were not/),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Save shift' }))
    await waitFor(() => expect(rpc.saveShift).toHaveBeenCalledTimes(2))
    expect(rpc.saveShift).toHaveBeenLastCalledWith(expect.objectContaining({ shiftId: 'shift-1' }))
  })

  it('shows the days off of a saved shift, and explains them on a new one', async () => {
    const user = userEvent.setup()
    render(<ShiftsPanel />)

    await user.click(await screen.findByRole('button', { name: 'New shift' }))
    let dialog = await screen.findByRole('dialog', { name: 'New shift' })
    expect(
      within(dialog).getByText('Save the shift to see and add its days off.'),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('combobox', { name: /Public holidays/ }))
    await user.click(await screen.findByRole('option', { name: 'Philippines' }))
    expect(
      within(dialog).getByText(
        'Save the shift to fill in the public holidays for Philippines, this year and next.',
      ),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Actions for Morning' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    dialog = await screen.findByRole('dialog', { name: 'Edit Morning' })
    expect(await within(dialog).findByText('Founders Day')).toBeInTheDocument()
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
