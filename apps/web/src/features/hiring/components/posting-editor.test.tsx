import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { DEFAULT_STAGES, type PostingRow } from '../schema'
import { PostingEditor } from './posting-editor'

const rpc = vi.hoisted(() => ({
  savePosting: vi.fn(),
  setPostingStatus: vi.fn(),
}))
const forms = vi.hoisted(() => ({ listForms: vi.fn() }))
const organization = vi.hoisted(() => ({ listTeams: vi.fn() }))
const nav = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@/features/requests/rpc', () => forms)
vi.mock('@/features/organization/actions', () => organization)
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
}))

const SAVED: PostingRow = {
  id: 'post-1',
  slug: 'registered-nurse-abc123',
  title: 'Registered nurse',
  summary: '',
  description: 'You will care for patients across our outpatient clinics.',
  location: '',
  workplace: 'onsite',
  employmentType: 'full_time',
  salaryMin: undefined,
  salaryMax: undefined,
  salaryCurrency: 'USD',
  salaryPeriod: 'year',
  status: 'draft',
  resumeRequired: true,
  stages: [...DEFAULT_STAGES],
  applicationFormId: undefined,
  applicationFormName: undefined,
  applicationFields: [],
  scorecardFormId: undefined,
  scorecardFormName: undefined,
  teamId: undefined,
  teamName: undefined,
  openedAt: undefined,
  closesAt: undefined,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  applicantCount: 0,
  activeCount: 0,
  stageCounts: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  organization.listTeams.mockResolvedValue({ ok: true, data: [] })
  forms.listForms.mockResolvedValue({
    rows: [],
    pageInfo: {
      page: 1,
      pageSize: 100,
      total: 0,
      pageCount: 1,
      hasPrevious: false,
      hasNext: false,
    },
  })
})

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Job title/), 'Registered nurse')
  // Pasted rather than typed: a paragraph keyed one letter at a time only slows the suite.
  await user.click(screen.getByLabelText(/Job description/))
  await user.paste('You will care for patients across our outpatient clinics.')
}

describe('PostingEditor', () => {
  it('names each missing field when a save is tried too early', async () => {
    const user = userEvent.setup()
    const { container } = render(<PostingEditor defaultStages={DEFAULT_STAGES} />)

    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Give the job a title.')).toHaveAttribute('role', 'alert')
    expect(
      screen.getByText('Describe the role, so an applicant knows what they are applying for.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Job title/)).toHaveAttribute('aria-invalid', 'true')
    expect(rpc.savePosting).not.toHaveBeenCalled()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('starts a new posting from the default stages and lands on it once saved', async () => {
    rpc.savePosting.mockResolvedValue(SAVED)
    const user = userEvent.setup()
    render(<PostingEditor defaultStages={DEFAULT_STAGES} />)

    expect(screen.getAllByLabelText(/Stage name/)).toHaveLength(DEFAULT_STAGES.length)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/hiring/postings/post-1'))
    expect(rpc.savePosting).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Registered nurse',
        stages: DEFAULT_STAGES,
        salaryMin: '',
        resumeRequired: true,
      }),
    )
  })

  it('publishes by saving first, then opening the posting', async () => {
    rpc.savePosting.mockResolvedValue(SAVED)
    rpc.setPostingStatus.mockResolvedValue({ ...SAVED, status: 'open' })
    const user = userEvent.setup()
    render(<PostingEditor defaultStages={DEFAULT_STAGES} />)

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() =>
      expect(rpc.setPostingStatus).toHaveBeenCalledWith({ postingId: 'post-1', status: 'open' }),
    )
  })

  it('saves a bulleted description as HTML', async () => {
    rpc.savePosting.mockResolvedValue(SAVED)
    const user = userEvent.setup()
    render(<PostingEditor defaultStages={DEFAULT_STAGES} />)

    await fillRequired(user)
    await user.click(await screen.findByRole('button', { name: 'Bullet list' }))
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() =>
      expect(rpc.savePosting).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            '<ul><li><p>You will care for patients across our outpatient clinics.</p></li></ul>',
        }),
      ),
    )
  })

  it('opens an older plain-text description as paragraphs', async () => {
    render(
      <PostingEditor
        posting={{ ...SAVED, description: 'You will care for patients.\n\nNights and weekends.' }}
        defaultStages={DEFAULT_STAGES}
      />,
    )

    const editor = await screen.findByRole('textbox', { name: /Job description/ })
    expect(within(editor).getByText('You will care for patients.').tagName).toBe('P')
    expect(within(editor).getByText('Nights and weekends.').tagName).toBe('P')
  })

  it('keeps what was typed and says why when the server refuses', async () => {
    rpc.savePosting.mockRejectedValue(
      new Error('1 applicant is still in a stage you removed — move them first.'),
    )
    const user = userEvent.setup()
    render(<PostingEditor posting={SAVED} defaultStages={DEFAULT_STAGES} />)

    await user.clear(screen.getByLabelText(/Job title/))
    await user.type(screen.getByLabelText(/Job title/), 'Senior nurse')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(
      await screen.findByText('1 applicant is still in a stage you removed — move them first.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Job title/)).toHaveValue('Senior nurse')
  })

  it('refuses a pay range that runs backwards', async () => {
    const user = userEvent.setup()
    render(<PostingEditor posting={SAVED} defaultStages={DEFAULT_STAGES} />)

    await user.type(screen.getByLabelText('From'), '5000')
    await user.type(screen.getByLabelText('To'), '100')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(
      await screen.findByText('The lowest pay cannot be above the highest.'),
    ).toBeInTheDocument()
    expect(rpc.savePosting).not.toHaveBeenCalled()
  })

  it('offers to stop taking applications on an open posting', () => {
    render(<PostingEditor posting={{ ...SAVED, status: 'open' }} defaultStages={DEFAULT_STAGES} />)

    expect(
      screen.getByRole('button', { name: 'Save and stop taking applications' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View public page/ })).toHaveAttribute(
      'href',
      '/careers/registered-nurse-abc123',
    )
  })
})
