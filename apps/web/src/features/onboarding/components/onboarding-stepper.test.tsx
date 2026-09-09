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

const actions = vi.hoisted(() => ({ completeOnboarding: vi.fn(), uploadPhoto: vi.fn() }))

vi.mock('../actions', () => ({
  completeOnboarding: actions.completeOnboarding,
  uploadPhoto: actions.uploadPhoto,
}))

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
  photoKey: 'users/u1/photo-existing.jpg',
  confirmed: false,
}

function renderStepper(values: Partial<OnboardingValues> = {}) {
  return render(
    <OnboardingStepper
      email="ada@innovarehp.com"
      photoUrl={undefined}
      defaultValues={{ ...defaultValues, ...values }}
    />,
  )
}

const user = () => userEvent.setup()

function jpeg(name: string) {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: 'image/jpeg' })
}

describe('OnboardingStepper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    url.write('')
    actions.completeOnboarding.mockResolvedValue({ ok: true })
    actions.uploadPhoto.mockResolvedValue({
      ok: true,
      key: 'users/u1/photo-new.jpg',
      url: 'https://s3.test/photo-new.jpg',
    })
  })

  it('opens on the first step with the sign-in address shown but not editable', () => {
    renderStepper()

    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
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
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
  })

  it('advances once the required names are filled in', async () => {
    const person = user()
    renderStepper()

    await person.type(screen.getByLabelText(/First name/), 'Ada')
    await person.type(screen.getByLabelText(/Last name/), 'Lovelace')
    await person.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Step 2 of 4')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Current position/ })).toBeInTheDocument()
  })

  it('records a department chosen from the seeded list', async () => {
    const person = user()
    renderStepper({ firstName: 'Ada', lastName: 'Lovelace', startDate: '2026-01-05' })

    url.write('step=1')
    await person.click(await screen.findByRole('combobox', { name: /Department/ }))
    await person.click(screen.getByRole('option', { name: 'Finance' }))
    await person.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Step 3 of 4')).toBeInTheDocument()

    url.write('step=3')
    expect(await screen.findByText('Finance')).toBeInTheDocument()
  })

  it('uploads the chosen photo and records the key it returns', async () => {
    const person = user()
    renderStepper({ photoKey: '' })

    url.write('step=2')
    await person.upload(await screen.findByLabelText('Photo file'), jpeg('face.jpg'))

    await waitFor(() => expect(actions.uploadPhoto).toHaveBeenCalledWith(expect.any(FormData)))
    const sent = actions.uploadPhoto.mock.calls[0]?.[0] as FormData
    expect((sent.get('photo') as File).name).toBe('face.jpg')
    expect(sent.get('previousKey')).toBe('')

    expect(await screen.findByAltText('')).toHaveAttribute('src', 'https://s3.test/photo-new.jpg')
  })

  it('passes the previous key so a replaced photo is cleaned up', async () => {
    const person = user()
    renderStepper()

    url.write('step=2')
    await person.upload(await screen.findByLabelText('Photo file'), jpeg('newer.jpg'))

    await waitFor(() => expect(actions.uploadPhoto).toHaveBeenCalled())
    const sent = actions.uploadPhoto.mock.calls[0]?.[0] as FormData
    expect(sent.get('previousKey')).toBe('users/u1/photo-existing.jpg')
  })

  it('explains a failed upload without losing the step', async () => {
    actions.uploadPhoto.mockResolvedValue({ ok: false, message: 'That photo is over 5 MB.' })
    const person = user()
    renderStepper({ photoKey: '' })

    url.write('step=2')
    await person.upload(await screen.findByLabelText('Photo file'), jpeg('huge.jpg'))

    expect(await screen.findByRole('alert')).toHaveTextContent('That photo is over 5 MB.')
    expect(await screen.findByText('Step 3 of 4')).toBeInTheDocument()
  })

  it('sends an unfinished photo step back rather than submitting', async () => {
    const person = user()
    const view = renderStepper({
      firstName: 'Ada',
      lastName: 'Lovelace',
      startDate: '2026-01-05',
      photoKey: '',
    })

    url.write('step=3')
    await person.click(await screen.findByLabelText('These details are correct.'))
    await person.click(screen.getByRole('button', { name: 'Finish setup' }))

    const { container } = view
    expect(await screen.findByText('Step 3 of 4')).toBeInTheDocument()
    expect(await screen.findByText('Add a photo to finish setup')).toBeInTheDocument()
    expect(actions.completeOnboarding).not.toHaveBeenCalled()
    // The invalid state renders extra ARIA wiring, so it gets its own axe pass.
    expect(await axe(container)).toHaveNoViolations()
  })

  it('blocks the final submit until the confirmation box is ticked', async () => {
    const person = user()
    renderStepper({ firstName: 'Ada', lastName: 'Lovelace', startDate: '2026-01-05' })

    url.write('step=3')
    await person.click(await screen.findByRole('button', { name: 'Finish setup' }))

    expect(await screen.findByText('Confirm that these details are correct')).toBeInTheDocument()
    expect(actions.completeOnboarding).not.toHaveBeenCalled()
  })

  it('sends the whole profile once and lands the user on the dashboard', async () => {
    const person = user()
    renderStepper({ firstName: 'Ada', lastName: 'Lovelace', startDate: '2026-01-05' })

    url.write('step=3')
    await person.click(await screen.findByLabelText('These details are correct.'))
    await person.click(screen.getByRole('button', { name: 'Finish setup' }))

    await waitFor(() =>
      expect(actions.completeOnboarding).toHaveBeenCalledWith({
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
    actions.completeOnboarding.mockResolvedValue({
      ok: false,
      message: 'Could not save your profile — check your connection and retry.',
    })
    const person = user()
    renderStepper({ firstName: 'Ada', lastName: 'Lovelace', startDate: '2026-01-05' })

    url.write('step=3')
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

    url.write('step=3')
    await person.click(await screen.findByLabelText('These details are correct.'))
    await person.click(screen.getByRole('button', { name: 'Finish setup' }))

    expect(await screen.findByText('Step 1 of 4')).toBeInTheDocument()
    expect(actions.completeOnboarding).not.toHaveBeenCalled()
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
    await waitFor(() => expect(screen.getByLabelText('Photo file')).toBeInTheDocument())
    expect(await axe(container)).toHaveNoViolations()

    url.write('step=3')
    await waitFor(() =>
      expect(screen.getByLabelText('These details are correct.')).toBeInTheDocument(),
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
