import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { AttendanceSettingsRow } from '../schema'
import { AttendanceSettingsForm } from './attendance-settings-form'

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
  requireSelfie: false,
  requireNote: false,
  captureLocation: false,
  autoClockOutHours: 16,
  shiftStartMinutes: 9 * 60,
  shiftEndMinutes: 18 * 60,
  graceMinutes: 15,
  workdays: '1,2,3,4,5',
  timeZone: 'UTC',
}

describe('AttendanceSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getAttendanceSettings.mockResolvedValue({ settings: RULES, canManage: true })
    rpc.updateAttendanceSettings.mockResolvedValue(RULES)
  })

  it('shows a member nothing at all', async () => {
    rpc.getAttendanceSettings.mockResolvedValue({ settings: RULES, canManage: false })
    render(<AttendanceSettingsForm />)

    await waitFor(() => expect(rpc.getAttendanceSettings).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save rules' })).not.toBeInTheDocument(),
    )
  })

  it('turns the selfie requirement on for the whole company', async () => {
    const user = userEvent.setup()
    render(<AttendanceSettingsForm />)

    await user.click(await screen.findByRole('switch', { name: /A selfie is required/ }))
    await user.click(screen.getByRole('button', { name: 'Save rules' }))

    await waitFor(() =>
      expect(rpc.updateAttendanceSettings).toHaveBeenCalledWith(
        expect.objectContaining({ requireSelfie: true }),
      ),
    )
  })

  it('says a failure out loud and leaves the rules on screen', async () => {
    const user = userEvent.setup()
    rpc.updateAttendanceSettings.mockRejectedValue(
      new Error('Only an admin sets the attendance rules.'),
    )
    render(<AttendanceSettingsForm />)

    await user.click(await screen.findByRole('switch', { name: /A note is required/ }))
    await user.click(screen.getByRole('button', { name: 'Save rules' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only an admin sets the attendance rules.' }),
      ),
    )
  })

  it('waits for a change before offering to save', async () => {
    render(<AttendanceSettingsForm />)

    expect(await screen.findByRole('button', { name: 'Save rules' })).toBeDisabled()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<AttendanceSettingsForm />)

    await screen.findByRole('button', { name: 'Save rules' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
