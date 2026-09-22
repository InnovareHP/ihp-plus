import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { DEFAULT_SHIFT, type AttendanceSettingsRow } from '../schema'
import { AttendanceSettingsForm } from './attendance-settings-form'

const rpc = vi.hoisted(() => ({
  getTimeClock: vi.fn(),
  getAttendanceSettings: vi.fn(),
  updateAttendanceSettings: vi.fn(),
  listShifts: vi.fn(),
  listSchedules: vi.fn(),
  saveShift: vi.fn(),
  deleteShift: vi.fn(),
  assignShift: vi.fn(),
  listAttendance: vi.fn(),
  clockIn: vi.fn(),
  clockOut: vi.fn(),
  startBreak: vi.fn(),
  endBreak: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const SETTINGS: AttendanceSettingsRow = { timeZone: 'UTC', defaultShiftId: '' }

const MORNING = { ...DEFAULT_SHIFT, id: 'shift-1', name: 'Morning', isDefault: false }

// Mantine's Select carries a hidden input holding the value beside the one people click.
async function picker(name: string) {
  const inputs = await screen.findAllByLabelText(name)
  return inputs.find((input) => input.getAttribute('type') !== 'hidden') as HTMLElement
}

describe('AttendanceSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getAttendanceSettings.mockResolvedValue({ settings: SETTINGS, canManage: true })
    rpc.updateAttendanceSettings.mockResolvedValue(SETTINGS)
    rpc.listShifts.mockResolvedValue({ shifts: [MORNING], settings: SETTINGS })
  })

  it('shows a member nothing at all', async () => {
    rpc.getAttendanceSettings.mockResolvedValue({ settings: SETTINGS, canManage: false })
    render(<AttendanceSettingsForm />)

    await waitFor(() => expect(rpc.getAttendanceSettings).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument(),
    )
  })

  it('says where the clock rules live now', async () => {
    render(<AttendanceSettingsForm />)

    expect(await screen.findByText(/belong to a shift/)).toBeInTheDocument()
  })

  it('names the shift the company falls back to', async () => {
    const user = userEvent.setup()
    render(<AttendanceSettingsForm />)

    await user.click(await picker('Company hours'))
    await user.click(await screen.findByRole('option', { name: /Morning/ }))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() =>
      expect(rpc.updateAttendanceSettings).toHaveBeenCalledWith(
        expect.objectContaining({ defaultShiftId: 'shift-1' }),
      ),
    )
  })

  it('says a failure out loud', async () => {
    const user = userEvent.setup()
    rpc.updateAttendanceSettings.mockRejectedValue(
      new Error('Only an admin sets the attendance rules.'),
    )
    render(<AttendanceSettingsForm />)

    await user.click(await picker('Company hours'))
    await user.click(await screen.findByRole('option', { name: /Morning/ }))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only an admin sets the attendance rules.' }),
      ),
    )
  })

  it('waits for a change before offering to save', async () => {
    render(<AttendanceSettingsForm />)

    expect(await screen.findByRole('button', { name: 'Save settings' })).toBeDisabled()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<AttendanceSettingsForm />)

    await screen.findByRole('button', { name: 'Save settings' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
