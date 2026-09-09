import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { OnboardingValues } from '../schema'
import { OnboardingStepper } from './onboarding-stepper'

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))

// The stepper keeps the step in the URL, so the mock has to behave like a real one.
const url = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  let search = ''
  return {
    read: () => search,
    write: (next: string) => {
      search = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
})

const complete = vi.hoisted(() => ({ completeOnboarding: vi.fn() }))

vi.mock('../actions', () => ({ completeOnboarding: complete.completeOnboarding }))

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useRouter: () => ({
      push: (href: string) => url.write(href.split('?')[1] ?? ''),
      replace: router.replace,
      refresh: router.refresh,
    }),
    useSearchParams: () =>
      new URLSearchParams(useSyncExternalStore(url.subscribe, url.read, url.read)),
  }
})

const defaultValues: OnboardingValues = {
  firstName: '',
  middleInitial: '',
  lastName: '',
  preferredName: '',
  phone: '',
  dateOfBirth: '',
  jobTitle: 'Data Analyst',
  department: 'Information Technology',
  employmentType: 'Full-time',
  startDate: '',
  employeeId: '',
  confirmed: false,
}

function renderStepper(values: Partial<OnboardingValues> = {}) {
  return render(
    <OnboardingStepper
      email="ada@innovarehp.com"
      defaultValues={{ ...defaultValues, ...values }}
    />,
  )
}

const user = () => userEvent.setup()

describe('OnboardingStepper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    url.write('')
    complete.completeOnboarding.mockResolvedValue({ ok: true })
  })

  it('opens on the first step with the sign-in address shown but not editable', () => {
    renderStepper()

    expect(screen.getByText('Step 1 of 3 · Name and contact')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toHaveValue('ada@innovarehp.com')
    expect(screen.getByLabelText('Email address')).toHaveAttribute('readonly')
  })

  it('refuses to advance while a required name is missing and announces why', async () => {
    const person = user()
    renderStepper()

    await person.click(screen.getByRole('button', { name: 'Continue' }))

    const error = await screen.findByText('First name is required')
    expect(error).toBeInTheDocument()
    expect(screen.getByLabelText(/First name/)).toHaveFocus()
    expect(screen.getByText('Step 1 of 3 · Name and contact')).toBeInTheDocument()
  })

  it('advances once the required names are filled in', async () => {
    const person = user()
    renderStepper()

    await person.type(screen.getByLabelText(/First name/), 'Ada')
    await person.type(screen.getByLabelText(/Last name/), 'Lovelace')
    await person.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Step 2 of 3 · Position and employment')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Current position/ })).toBeInTheDocument()
  })

  it('records a department chosen from the seeded list', async () => {
    const person = user()
    renderStepper({ firstName: 'Ada', lastName: 'Lovelace', startDate: '2026-01-05' })

    url.write('step=1')
    await person.click(await screen.findByRole('combobox', { name: /Department/ }))
    await person.click(screen.getByRole('option', { name: 'Finance' }))
    await person.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Step 3 of 3 · Confirm and finish')).toBeInTheDocument()
    expect(screen.getByText('Finance')).toBeInTheDocument()
  })

  it('blocks the final submit until the confirmation box is ticked', async () => {
    const person = user()
    renderStepper({ firstName: 'Ada', lastName: 'Lovelace', startDate: '2026-01-05' })

    url.write('step=2')
    await person.click(await screen.findByRole('button', { name: 'Finish setup' }))

    expect(await screen.findByText('Confirm that these details are correct')).toBeInTheDocument()
    expect(complete.completeOnboarding).not.toHaveBeenCalled()
  })

  it('sends the whole profile once and lands the user on the dashboard', async () => {
    const person = user()
    renderStepper({ firstName: 'Ada', lastName: 'Lovelace', startDate: '2026-01-05' })

    url.write('step=2')
    await person.click(await screen.findByLabelText('These details are correct.'))
    await person.click(screen.getByRole('button', { name: 'Finish setup' }))

    await waitFor(() =>
      expect(complete.completeOnboarding).toHaveBeenCalledWith({
        ...defaultValues,
        firstName: 'Ada',
        lastName: 'Lovelace',
        startDate: '2026-01-05',
        confirmed: true,
      }),
    )
    expect(router.replace).toHaveBeenCalledWith('/')
    expect(router.refresh).toHaveBeenCalled()
  })

  it('keeps the user on the review step and explains a server failure', async () => {
    complete.completeOnboarding.mockResolvedValue({
      ok: false,
      message: 'Could not save your profile — check your connection and retry.',
    })
    const person = user()
    renderStepper({ firstName: 'Ada', lastName: 'Lovelace', startDate: '2026-01-05' })

    url.write('step=2')
    await person.click(await screen.findByLabelText('These details are correct.'))
    await person.click(screen.getByRole('button', { name: 'Finish setup' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Could not save your profile — check your connection and retry.',
    )
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('sends a deep link that skipped answers back to the step that owns them', async () => {
    const person = user()
    renderStepper()

    url.write('step=2')
    await person.click(await screen.findByLabelText('These details are correct.'))
    await person.click(screen.getByRole('button', { name: 'Finish setup' }))

    expect(await screen.findByText('Step 1 of 3 · Name and contact')).toBeInTheDocument()
    expect(complete.completeOnboarding).not.toHaveBeenCalled()
  })

  it('has no axe violations on any step', async () => {
    const { container } = renderStepper()
    expect(await axe(container)).toHaveNoViolations()

    url.write('step=1')
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /Current position/ })).toBeInTheDocument(),
    )
    expect(await axe(container)).toHaveNoViolations()

    url.write('step=2')
    await waitFor(() =>
      expect(screen.getByLabelText('These details are correct.')).toBeInTheDocument(),
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
