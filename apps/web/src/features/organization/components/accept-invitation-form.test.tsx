import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { AcceptInvitationForm } from './accept-invitation-form'

const actions = vi.hoisted(() => ({
  acceptInvitation: vi.fn(),
  rejectInvitation: vi.fn(),
}))

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))

vi.mock('../accept-actions', () => actions)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, refresh: nav.refresh, push: vi.fn() }),
}))

const user = () => userEvent.setup()

function renderForm() {
  return render(<AcceptInvitationForm invitationId="invite-1" organizationName="Innovare" />)
}

describe('AcceptInvitationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.acceptInvitation.mockResolvedValue({ ok: true })
    actions.rejectInvitation.mockResolvedValue({ ok: true })
  })

  it('joins the organization and lands the new member on the dashboard', async () => {
    const person = user()
    renderForm()

    await person.click(screen.getByRole('button', { name: 'Join Innovare' }))

    await waitFor(() =>
      expect(actions.acceptInvitation).toHaveBeenCalledWith({ invitationId: 'invite-1' }),
    )
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/'))
  })

  it('says what went wrong and stays put when the invitation is refused', async () => {
    actions.acceptInvitation.mockResolvedValue({
      ok: false,
      message: 'This invitation was sent to another address.',
    })
    const person = user()
    renderForm()

    await person.click(screen.getByRole('button', { name: 'Join Innovare' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This invitation was sent to another address.',
    )
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('declines the invitation and returns to sign in', async () => {
    const person = user()
    renderForm()

    await person.click(screen.getByRole('button', { name: 'Decline' }))

    await waitFor(() =>
      expect(actions.rejectInvitation).toHaveBeenCalledWith({ invitationId: 'invite-1' }),
    )
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login'))
  })

  it('has no axe violations', async () => {
    const { container } = renderForm()
    expect(await axe(container)).toHaveNoViolations()
  })
})
