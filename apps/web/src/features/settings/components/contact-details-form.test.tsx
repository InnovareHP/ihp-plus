import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { ContactDetailsForm } from './contact-details-form'

const actions = vi.hoisted(() => ({ updateContactDetails: vi.fn() }))
const onboarding = vi.hoisted(() => ({ uploadPhoto: vi.fn() }))
const nav = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@/features/onboarding/actions', () => onboarding)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: nav.refresh, replace: vi.fn(), push: vi.fn() }),
}))

const DEFAULTS = {
  preferredName: 'Ada',
  phone: '',
  photoKey: 'users/user-1/photo-old.jpg',
}

function renderForm() {
  return render(
    <ContactDetailsForm
      defaultValues={DEFAULTS}
      initialPhotoUrl="https://files.ihp.test/photo-old.jpg"
      initials="AL"
    />,
  )
}

describe('ContactDetailsForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    actions.updateContactDetails.mockResolvedValue({ ok: true })
    onboarding.uploadPhoto.mockResolvedValue({
      ok: true,
      key: 'users/user-1/photo-new.jpg',
      url: 'https://files.ihp.test/photo-new.jpg',
    })
  })

  it('saves the edited details and confirms in place', async () => {
    const person = userEvent.setup()
    renderForm()

    await person.type(screen.getByRole('textbox', { name: 'Phone' }), '(609) 555-0134')
    await person.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(actions.updateContactDetails).toHaveBeenCalledWith({
        preferredName: 'Ada',
        phone: '(609) 555-0134',
        photoKey: 'users/user-1/photo-old.jpg',
      }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
    expect(nav.refresh).toHaveBeenCalled()
  })

  it('puts a server refusal on the field it belongs to', async () => {
    actions.updateContactDetails.mockResolvedValue({
      ok: false,
      message: 'That photo could not be used. Upload it again.',
      field: 'photoKey',
    })
    const person = userEvent.setup()
    renderForm()

    await person.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('That photo could not be used. Upload it again.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('refuses an undialable phone before reaching the server', async () => {
    const person = userEvent.setup()
    renderForm()

    await person.type(screen.getByRole('textbox', { name: 'Phone' }), 'call me')
    await person.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Enter a phone number we can dial')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Phone' })).toHaveAttribute('aria-invalid', 'true')
    expect(actions.updateContactDetails).not.toHaveBeenCalled()
  })

  it('uploads a new photo without deleting the one on file, and saves its key', async () => {
    const person = userEvent.setup()
    const { container } = renderForm()
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('The photo input did not render.')

    await person.upload(input, new File(['jpeg'], 'me.jpg', { type: 'image/jpeg' }))

    await waitFor(() => expect(onboarding.uploadPhoto).toHaveBeenCalled())
    const sent = onboarding.uploadPhoto.mock.calls[0]?.[0] as FormData
    expect(sent.get('previousKey')).toBe('')

    await person.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(actions.updateContactDetails).toHaveBeenCalledWith(
        expect.objectContaining({ photoKey: 'users/user-1/photo-new.jpg' }),
      ),
    )
  })

  it('has no axe violations', async () => {
    const { container } = renderForm()

    expect(await axe(container)).toHaveNoViolations()
  })
})
