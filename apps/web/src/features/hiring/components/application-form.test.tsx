import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { PublicPosting } from '../schema'
import { ApplicationForm } from './application-form'

const actions = vi.hoisted(() => ({
  submitApplication: vi.fn(),
  uploadApplicationFile: vi.fn(),
  withdrawApplication: vi.fn(),
}))
const nav = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('../public-actions', () => actions)
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: nav.replace }) }))

const POSTING: PublicPosting = {
  slug: 'registered-nurse-abc123',
  title: 'Registered nurse',
  summary: '',
  description: 'You will care for patients.',
  location: 'Manila',
  workplace: 'onsite',
  employmentType: 'full_time',
  salaryMin: undefined,
  salaryMax: undefined,
  salaryCurrency: 'PHP',
  salaryPeriod: 'month',
  teamName: undefined,
  openedAt: '2026-09-01T00:00:00.000Z',
  closesAt: undefined,
  resumeRequired: true,
  applicationFields: [
    {
      id: 'years',
      type: 'number',
      label: 'Years of experience',
      help: '',
      placeholder: '',
      required: true,
      options: [],
    },
  ],
  isOpen: true,
}

function renderForm(posting: PublicPosting = POSTING) {
  return render(<ApplicationForm posting={posting} organizationName="IHP+" />)
}

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Full name/), 'Grace Hopper')
  await user.type(screen.getByLabelText(/^Email/), 'grace@example.com')
  // Mantine's FileInput is a button over a hidden input, and the input is what takes the file.
  const input = document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement
  await user.upload(input, new File(['cv'], 'grace-cv.pdf', { type: 'application/pdf' }))
  await screen.findByText('Uploaded — it is sent with your application.')
  await user.type(screen.getByLabelText(/Years of experience/), '4')
  await user.click(screen.getByRole('checkbox', { name: /may keep my details/ }))
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.uploadApplicationFile.mockResolvedValue({
    ok: true,
    data: { id: 'file-resume', fileName: 'grace-cv.pdf' },
  })
})

describe('ApplicationForm', () => {
  it('names every missing answer when sent too early, and announces each', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Send application' }))

    expect(await screen.findByText('Enter your full name.')).toHaveAttribute('role', 'alert')
    expect(screen.getByText('Enter an email address we can reach you at.')).toBeInTheDocument()
    expect(screen.getByText('Attach your resume.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Tick the box so we can keep your details while we review your application.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute('aria-invalid', 'true')
    expect(actions.submitApplication).not.toHaveBeenCalled()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sends the contact block and the answers apart, then lands on the status link', async () => {
    actions.submitApplication.mockResolvedValue({
      ok: true,
      data: { statusPath: '/careers/status/app-1/sig' },
    })
    const user = userEvent.setup()
    renderForm()

    await fillIn(user)
    await user.click(screen.getByRole('button', { name: 'Send application' }))

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/careers/status/app-1/sig'))
    expect(actions.submitApplication).toHaveBeenCalledWith({
      slug: 'registered-nurse-abc123',
      contact: {
        fullName: 'Grace Hopper',
        email: 'grace@example.com',
        phone: '',
        resumeId: 'file-resume',
        consent: true,
        website: '',
      },
      answers: { years: 4 },
    })
  })

  it('keeps everything typed and says why when the server refuses', async () => {
    actions.submitApplication.mockResolvedValue({
      ok: false,
      message: 'You have already applied for this role.',
    })
    const user = userEvent.setup()
    renderForm()

    await fillIn(user)
    await user.click(screen.getByRole('button', { name: 'Send application' }))

    expect(await screen.findByText('You have already applied for this role.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Grace Hopper')
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('lets a resume be left off when the posting does not require one', async () => {
    actions.submitApplication.mockResolvedValue({
      ok: true,
      data: { statusPath: '/careers/status/app-1/sig' },
    })
    const user = userEvent.setup()
    renderForm({ ...POSTING, resumeRequired: false, applicationFields: [] })

    await user.type(screen.getByLabelText(/Full name/), 'Grace Hopper')
    await user.type(screen.getByLabelText(/^Email/), 'grace@example.com')
    await user.click(screen.getByRole('checkbox', { name: /may keep my details/ }))
    await user.click(screen.getByRole('button', { name: 'Send application' }))

    await waitFor(() => expect(actions.submitApplication).toHaveBeenCalled())
  })

  it('keeps the bot trap out of reach of people and screen readers', () => {
    renderForm()

    expect(screen.queryByRole('textbox', { name: 'Leave this empty' })).not.toBeInTheDocument()
  })
})
