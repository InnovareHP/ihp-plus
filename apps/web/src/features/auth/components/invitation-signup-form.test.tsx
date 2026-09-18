import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { InvitationSignupForm } from './invitation-signup-form'

const mocks = vi.hoisted(() => ({
  signUpEmail: vi.fn(),
  signInSocial: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/accept-invitation/invite-1',
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signUp: { email: mocks.signUpEmail },
    signIn: { social: mocks.signInSocial },
  },
}))

function renderForm() {
  return render(<InvitationSignupForm invitationId="invite-1" email="ada@innovarehp.com" />)
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^password/i), 'correct-horse-battery')
  await user.type(screen.getByLabelText(/confirm password/i), 'correct-horse-battery')
}

describe('InvitationSignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signUpEmail.mockResolvedValue({ data: {}, error: null })
  })

  it('signs up with the invited address and returns there once the email is confirmed', async () => {
    const user = userEvent.setup()
    renderForm()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(mocks.signUpEmail).toHaveBeenCalledWith({
        name: 'ada',
        email: 'ada@innovarehp.com',
        password: 'correct-horse-battery',
        callbackURL: '/app/accept-invitation/invite-1',
      }),
    )
    expect(mocks.replace).toHaveBeenCalledWith(
      '/verify-email?email=ada%40innovarehp.com&next=%2Faccept-invitation%2Finvite-1',
    )
  })

  it('offers no way to change the address the invitation was sent to', () => {
    renderForm()

    const email = screen.getByLabelText(/email address/i)
    expect(email).toHaveValue('ada@innovarehp.com')
    expect(email).toBeDisabled()
  })

  it('rejects a password under twelve characters', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText(/^password/i), 'short')
    await user.tab()

    expect(await screen.findByText('Password must be at least 12 characters')).toBeInTheDocument()
  })

  it('rejects a mismatched confirmation', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText(/^password/i), 'correct-horse-battery')
    await user.type(screen.getByLabelText(/confirm password/i), 'something-else-here')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(mocks.signUpEmail).not.toHaveBeenCalled()
  })

  it('announces a server failure in a summary alert and stays put', async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { code: 'USER_ALREADY_EXISTS', message: 'raw code' },
    })
    const user = userEvent.setup()
    renderForm()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'An account with that email already exists. Try signing in instead.',
    )
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('has no axe violations', async () => {
    const { container } = renderForm()
    expect(await axe(container)).toHaveNoViolations()
  })
})
