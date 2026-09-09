import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { SignupForm } from './signup-form'

const mocks = vi.hoisted(() => ({
  signUpEmail: vi.fn(),
  signInSocial: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: vi.fn() }),
  usePathname: () => '/signup',
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signUp: { email: mocks.signUpEmail },
    signIn: { social: mocks.signInSocial },
  },
}))

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), 'Ada Lovelace')
  await user.type(screen.getByLabelText(/email address/i), 'ada@innovarehp.com')
  await user.type(screen.getByLabelText(/^password/i), 'correct-horse-battery')
  await user.type(screen.getByLabelText(/confirm password/i), 'correct-horse-battery')
}

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signUpEmail.mockResolvedValue({ data: {}, error: null })
  })

  it('creates the account without forwarding the confirmation field', async () => {
    const user = userEvent.setup()
    render(<SignupForm />)

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(mocks.signUpEmail).toHaveBeenCalledWith({
        name: 'Ada Lovelace',
        email: 'ada@innovarehp.com',
        password: 'correct-horse-battery',
      }),
    )
    expect(mocks.replace).toHaveBeenCalledWith('/')
  })

  it('rejects a password under twelve characters', async () => {
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText(/^password/i), 'short')
    await user.tab()

    expect(await screen.findByText('Password must be at least 12 characters')).toBeInTheDocument()
  })

  it('rejects a mismatched confirmation', async () => {
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText(/full name/i), 'Ada Lovelace')
    await user.type(screen.getByLabelText(/email address/i), 'ada@innovarehp.com')
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse-battery')
    await user.type(screen.getByLabelText(/confirm password/i), 'something-else-here')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(mocks.signUpEmail).not.toHaveBeenCalled()
  })

  it('puts a duplicate address on the email field, not in the summary', async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { code: 'USER_ALREADY_EXISTS', message: 'raw code' },
    })
    const user = userEvent.setup()
    render(<SignupForm />)

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    const email = screen.getByLabelText(/email address/i)
    const error = await screen.findByText(
      'An account with that email already exists. Try signing in instead.',
    )
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email.getAttribute('aria-describedby')).toContain(error.id)
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('announces an unexpected server failure in a summary alert', async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { code: 'FAILED_TO_CREATE_USER', message: 'raw code' },
    })
    const user = userEvent.setup()
    render(<SignupForm />)

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The account could not be created. Try again in a moment.')
  })

  it('has no axe violations', async () => {
    const { container } = render(<SignupForm />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
