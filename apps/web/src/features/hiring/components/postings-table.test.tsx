import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { DEFAULT_STAGES, type PostingRow } from '../schema'
import { PostingsTable } from './postings-table'

const rpc = vi.hoisted(() => ({
  listPostings: vi.fn(),
  setPostingStatus: vi.fn(),
  deletePosting: vi.fn(),
}))
const organization = vi.hoisted(() => ({ listTeams: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@/features/organization/actions', () => organization)
vi.mock('@mantine/notifications', () => ({ notifications: toast }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/hiring',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const DRAFT: PostingRow = {
  id: 'post-1',
  slug: 'registered-nurse-abc123',
  title: 'Registered nurse',
  summary: '',
  description: 'You will care for patients across our outpatient clinics.',
  location: 'Manila',
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
  teamId: 'team-care',
  teamName: 'Care Management',
  openedAt: undefined,
  closesAt: undefined,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  applicantCount: 0,
  activeCount: 0,
  stageCounts: {},
}

const OPEN: PostingRow = {
  ...DRAFT,
  id: 'post-2',
  slug: 'billing-specialist-def456',
  title: 'Billing specialist',
  status: 'open',
  applicantCount: 7,
  activeCount: 4,
  closesAt: '2026-10-31T00:00:00.000Z',
}

function pageOf(rows: PostingRow[]) {
  return {
    rows,
    pageInfo: {
      page: 1,
      pageSize: 25,
      total: rows.length,
      pageCount: 1,
      hasPrevious: false,
      hasNext: false,
    },
  }
}

function lastToast() {
  return toast.show.mock.calls.at(-1)?.[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  organization.listTeams.mockResolvedValue({ ok: true, data: [] })
  rpc.listPostings.mockResolvedValue(pageOf([DRAFT, OPEN]))
})

describe('PostingsTable', () => {
  it('shows each posting with where it stands and how many have applied', async () => {
    const { container } = render(<PostingsTable />)

    const row = await screen.findByRole('row', { name: /Billing specialist/ })
    expect(within(row).getByText('Open')).toBeInTheDocument()
    expect(within(row).getByText('4 in progress')).toBeInTheDocument()
    expect(within(row).getByText('7 in total')).toBeInTheDocument()
    expect(within(row).getByText('Oct 31, 2026')).toBeInTheDocument()
    expect(
      within(screen.getByRole('row', { name: /Registered nurse/ })).getByText('None yet'),
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('says how to start when there are no postings', async () => {
    rpc.listPostings.mockResolvedValue(pageOf([]))
    render(<PostingsTable />)

    expect(await screen.findByText('No job postings yet')).toBeInTheDocument()
  })

  it('publishes a draft before the server answers', async () => {
    rpc.setPostingStatus.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<PostingsTable />)

    await user.click(await screen.findByRole('button', { name: 'Actions for Registered nurse' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Publish' }))

    const row = screen.getByRole('row', { name: /Registered nurse/ })
    expect(await within(row).findByText('Open')).toBeInTheDocument()
    expect(rpc.setPostingStatus).toHaveBeenCalledWith({ postingId: 'post-1', status: 'open' })
  })

  it('puts the status back and says why when publishing is refused', async () => {
    rpc.setPostingStatus.mockRejectedValue(new Error('Describe the role.'))
    rpc.listPostings
      .mockResolvedValueOnce(pageOf([DRAFT, OPEN]))
      .mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<PostingsTable />)

    await user.click(await screen.findByRole('button', { name: 'Actions for Registered nurse' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Publish' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red', message: 'Describe the role.', autoClose: false }),
      ),
    )
    const row = screen.getByRole('row', { name: /Registered nurse/ })
    expect(within(row).getByText('Draft')).toBeInTheDocument()
  })

  it('deletes a draft at once and only tells the server when undo is passed up', async () => {
    rpc.deletePosting.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<PostingsTable />)

    await user.click(await screen.findByRole('button', { name: 'Actions for Registered nurse' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete draft' }))

    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Registered nurse/ })).not.toBeInTheDocument(),
    )
    expect(rpc.deletePosting).not.toHaveBeenCalled()

    lastToast()?.onClose()
    await waitFor(() => expect(rpc.deletePosting).toHaveBeenCalledWith('post-1'))
  })

  it('offers archive rather than delete once a posting has been public', async () => {
    const user = userEvent.setup()
    render(<PostingsTable />)

    await user.click(await screen.findByRole('button', { name: 'Actions for Billing specialist' }))

    expect(await screen.findByRole('menuitem', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Delete draft' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Stop taking applications' })).toBeInTheDocument()
  })
})
