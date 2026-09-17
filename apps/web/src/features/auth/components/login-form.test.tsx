import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { LoginForm } from './login-form'

const mocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  searchParams: new URLSearchParams(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: vi.fn() }),
  useSearchParams: () => mocks.searchParams,
  usePathname: () => '/login',
}))

// Mocked at the service edge: the form must not know how the transport works.
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: mocks.signInEmail, social: mocks.signInSocial },
  },
}))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signInEmail.mockResolvedValue({ data: {}, error: null })
    mocks.signInSocial.mockResolvedValue({ data: {}, error: null })
  })

  it('signs in with the values the user typed and lands on the dashboard', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@innovarehp.com')
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(mocks.signInEmail).toHaveBeenCalledWith({
        email: 'ada@innovarehp.com',
        password: 'correct-horse-battery',
        rememberMe: true,
      }),
    )
    expect(mocks.replace).toHaveBeenCalledWith('/')
  })

  it('rejects a malformed email and links the message to the field', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    const email = screen.getByLabelText(/email address/i)
    await user.type(email, 'not-an-email')
    await user.tab()

    const error = await screen.findByText('Enter a valid email address')
    expect(error).toHaveAttribute('role', 'alert')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email.getAttribute('aria-describedby')).toContain(error.id)
    expect(mocks.signInEmail).not.toHaveBeenCalled()
  })

  it('requires a password', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@innovarehp.com')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Password is required')).toBeInTheDocument()
    expect(mocks.signInEmail).not.toHaveBeenCalled()
  })

  it('announces a rejected credential instead of navigating', async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'raw code should not be shown' },
    })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@innovarehp.com')
    await user.type(screen.getByLabelText(/^password/i), 'wrong-password-here')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('That email and password do not match an account.')
    expect(alert).not.toHaveTextContent('raw code should not be shown')
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('sends the sanitised next path to the Outlook redirect', async () => {
    mocks.searchParams = new URLSearchParams('next=//evil.example.com')
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: /continue with outlook/i }))

    await waitFor(() =>
      expect(mocks.signInSocial).toHaveBeenCalledWith({
        provider: 'microsoft',
        callbackURL: '/app',
      }),
    )
    mocks.searchParams = new URLSearchParams()
  })

  it('is reachable by keyboard alone', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.tab()
    expect(screen.getByLabelText(/email address/i)).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText(/^password/i)).toHaveFocus()
  })

  it('has no axe violations', async () => {
    const { container } = render(<LoginForm />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
