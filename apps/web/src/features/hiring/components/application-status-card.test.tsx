import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { ApplicationStatusView } from '../schema'
import { ApplicationStatusCard } from './application-status-card'

const actions = vi.hoisted(() => ({
  submitApplication: vi.fn(),
  uploadApplicationFile: vi.fn(),
  withdrawApplication: vi.fn(),
}))
const nav = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('../public-actions', () => actions)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh }) }))

const ACTIVE: ApplicationStatusView = {
  id: 'app-1',
  firstName: 'Grace',
  postingTitle: 'Registered nurse',
  postingSlug: 'registered-nurse-abc123',
  organizationName: 'IHP+',
  status: 'active',
  stageName: 'Interview',
  appliedAt: '2026-09-20T10:00:00.000Z',
  updatedAt: '2026-09-22T10:00:00.000Z',
}

beforeEach(() => vi.clearAllMocks())

describe('ApplicationStatusCard', () => {
  it('tells the applicant where it stands in plain words', async () => {
    const { container } = render(<ApplicationStatusCard application={ACTIVE} signature="sig" />)

    expect(
      screen.getByRole('heading', { name: 'Your application for Registered nurse' }),
    ).toBeInTheDocument()
    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(screen.getByText('Stage: Interview')).toBeInTheDocument()
    expect(screen.getByText(/Applied September 20, 2026/)).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('withdraws only after the applicant confirms, naming the job', async () => {
    actions.withdrawApplication.mockResolvedValue({ ok: true, data: undefined })
    const user = userEvent.setup()
    render(<ApplicationStatusCard application={ACTIVE} signature="sig" />)

    await user.click(screen.getByRole('button', { name: 'Withdraw application' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Withdraw your application for Registered nurse?',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw application' }))

    await waitFor(() => expect(nav.refresh).toHaveBeenCalled())
    expect(actions.withdrawApplication).toHaveBeenCalledWith({
      applicationId: 'app-1',
      signature: 'sig',
    })
  })

  it('keeps the dialog open with the reason when withdrawing fails', async () => {
    actions.withdrawApplication.mockResolvedValue({
      ok: false,
      message: 'This application has already been decided, so it cannot be withdrawn.',
    })
    const user = userEvent.setup()
    render(<ApplicationStatusCard application={ACTIVE} signature="sig" />)

    await user.click(screen.getByRole('button', { name: 'Withdraw application' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw application' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already been decided')
    expect(nav.refresh).not.toHaveBeenCalled()
  })

  it('offers no withdraw once the application is decided', () => {
    render(
      <ApplicationStatusCard application={{ ...ACTIVE, status: 'rejected' }} signature="sig" />,
    )

    expect(screen.getByText('Not moving forward')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Withdraw application' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Stage:/)).not.toBeInTheDocument()
  })
})
