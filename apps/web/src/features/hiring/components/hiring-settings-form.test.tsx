import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { DEFAULT_STAGES, type HiringSettings } from '../schema'
import { HiringSettingsForm } from './hiring-settings-form'

const rpc = vi.hoisted(() => ({ saveSettings: vi.fn(), getSettings: vi.fn() }))
const organization = vi.hoisted(() => ({ listTeams: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@/features/organization/actions', () => organization)
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))

const SETTINGS: HiringSettings = {
  hrTeamId: 'team-hr',
  hrTeamName: 'People & Culture',
  defaultStages: [...DEFAULT_STAGES],
  rejectionMessage: 'Thank you for applying.',
  canEditHrTeam: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  organization.listTeams.mockResolvedValue({
    ok: true,
    data: [{ id: 'team-hr', name: 'People & Culture', memberCount: 2, createdAt: '2026-01-01' }],
  })
})

describe('HiringSettingsForm', () => {
  it('shows HR who runs hiring but leaves that choice to an admin', async () => {
    const { container } = render(<HiringSettingsForm settings={SETTINGS} />)

    expect(screen.getByLabelText('HR department', { selector: 'input' })).toBeDisabled()
    expect(
      screen.getByText('Only an admin can change this, since it decides who may hire.'),
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('saves the rejection message and the stages together', async () => {
    rpc.saveSettings.mockImplementation(async (values) => ({ ...SETTINGS, ...values }))
    const user = userEvent.setup()
    render(<HiringSettingsForm settings={SETTINGS} />)

    await user.clear(screen.getByLabelText(/^Message/))
    await user.type(screen.getByLabelText(/^Message/), 'Not this time, but thank you.')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() =>
      expect(rpc.saveSettings).toHaveBeenCalledWith({
        hrTeamId: 'team-hr',
        defaultStages: DEFAULT_STAGES,
        rejectionMessage: 'Not this time, but thank you.',
      }),
    )
  })

  it('will not save an empty rejection message', async () => {
    const user = userEvent.setup()
    render(<HiringSettingsForm settings={SETTINGS} />)

    await user.clear(screen.getByLabelText(/^Message/))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    expect(
      await screen.findByText('Write the message a rejected applicant receives.'),
    ).toHaveAttribute('role', 'alert')
    expect(rpc.saveSettings).not.toHaveBeenCalled()
  })
})
