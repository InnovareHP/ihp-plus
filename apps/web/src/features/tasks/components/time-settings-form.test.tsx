import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { TimeSettingsForm } from './time-settings-form'

const rpc = vi.hoisted(() => ({
  getTimeSettings: vi.fn(),
  updateTimeSettings: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const RULES = {
  allowManualEntry: true,
  allowSelfEdit: true,
  requireNote: false,
  trackOnlyAssigned: false,
  autoStopHours: 12,
}

describe('TimeSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getTimeSettings.mockResolvedValue({ settings: RULES, canManage: true })
    rpc.updateTimeSettings.mockResolvedValue(RULES)
  })

  it('shows a member nothing at all', async () => {
    rpc.getTimeSettings.mockResolvedValue({ settings: RULES, canManage: false })
    render(<TimeSettingsForm />)

    await waitFor(() => expect(rpc.getTimeSettings).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save rules' })).not.toBeInTheDocument(),
    )
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('saves the rules an admin changed', async () => {
    const user = userEvent.setup()
    render(<TimeSettingsForm />)

    await user.click(await screen.findByRole('switch', { name: /Members can log time by hand/ }))
    await user.click(screen.getByRole('button', { name: 'Save rules' }))

    await waitFor(() =>
      expect(rpc.updateTimeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ allowManualEntry: false }),
      ),
    )
  })

  it('waits for a change before offering to save', async () => {
    render(<TimeSettingsForm />)

    expect(await screen.findByRole('button', { name: 'Save rules' })).toBeDisabled()
  })

  it('says why the server refused', async () => {
    const user = userEvent.setup()
    rpc.updateTimeSettings.mockRejectedValue(new Error('Only an admin sets the clock rules.'))
    render(<TimeSettingsForm />)

    await user.click(
      await screen.findByRole('switch', { name: /A note is required on every entry/ }),
    )
    await user.click(screen.getByRole('button', { name: 'Save rules' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only an admin sets the clock rules.',
    )
  })

  it('has no axe violations', async () => {
    const { container } = render(<TimeSettingsForm />)
    await screen.findByRole('button', { name: 'Save rules' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
