import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { DEFAULT_STAGES, type ApplicationDetail } from '../schema'
import { ApplicationDetailView } from './application-detail-view'

const rpc = vi.hoisted(() => ({
  getApplication: vi.fn(),
  moveApplication: vi.fn(),
  rejectApplication: vi.fn(),
  reopenApplication: vi.fn(),
  addNote: vi.fn(),
  deleteNote: vi.fn(),
}))
const toast = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: toast }))

const DETAIL: ApplicationDetail = {
  summary: {
    id: 'app-1',
    postingId: 'post-1',
    postingTitle: 'Registered nurse',
    fullName: 'Grace Hopper',
    email: 'grace@example.com',
    phone: '+63 900 000 0000',
    status: 'active',
    stageId: 'screening',
    stageName: 'Screening',
    stageChangedAt: '2026-09-21T10:00:00.000Z',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-21T10:00:00.000Z',
    hasResume: true,
  },
  fields: [
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
  values: { years: 4 },
  files: [
    {
      id: 'file-resume',
      fieldId: 'resume',
      fileName: 'grace-cv.pdf',
      contentType: 'application/pdf',
      fileSize: 20480,
    },
  ],
  notes: [
    {
      id: 'note-1',
      authorId: 'user-hr',
      authorName: 'Rita',
      body: 'Strong phone call.',
      createdAt: '2026-09-21T11:00:00.000Z',
      isMine: true,
    },
  ],
  events: [
    {
      id: 'e1',
      label: 'Applied through the careers page',
      actorName: undefined,
      detail: undefined,
      createdAt: '2026-09-20T10:00:00.000Z',
    },
  ],
  stages: [...DEFAULT_STAGES],
  rejectionReason: undefined,
  postingSlug: 'registered-nurse-abc123',
}

function renderView(detail: ApplicationDetail = DETAIL) {
  rpc.getApplication.mockResolvedValue(detail)
  return render(
    <ApplicationDetailView application={detail} rejectionMessage="Thanks." viewerName="Rita" />,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('ApplicationDetailView', () => {
  it('shows where they stand, how to reach them, what they sent and said', async () => {
    const { container } = renderView()

    expect(screen.getByText('Stage: Screening')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'grace@example.com' })).toHaveAttribute(
      'href',
      'mailto:grace@example.com',
    )
    expect(screen.getByRole('link', { name: 'grace-cv.pdf' })).toHaveAttribute(
      'href',
      '/app/api/hiring/attachments/file-resume',
    )
    expect(screen.getByText('Years of experience')).toBeInTheDocument()
    expect(screen.getByText('The applicant', { exact: false })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('adds a note before the server answers', async () => {
    rpc.addNote.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderView()

    await user.type(screen.getByLabelText(/Add a note/), 'Second interview booked.')
    await user.click(screen.getByRole('button', { name: 'Add note' }))

    const notes = screen.getByRole('list', { name: 'Notes' })
    expect(await within(notes).findByText('Second interview booked.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Add a note/)).toHaveValue('')
    expect(rpc.addNote).toHaveBeenCalledWith({
      applicationId: 'app-1',
      body: 'Second interview booked.',
    })
  })

  it('takes a note back out and says why when saving it fails', async () => {
    rpc.addNote.mockRejectedValue(new Error('Could not save that note.'))
    const user = userEvent.setup()
    renderView()

    await user.type(screen.getByLabelText(/Add a note/), 'Lost note')
    await user.click(screen.getByRole('button', { name: 'Add note' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Could not save that note.' }),
      ),
    )
    expect(screen.queryByText('Lost note')).not.toBeInTheDocument()
  })

  it('deletes your own note behind an undo', async () => {
    rpc.deleteNote.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: /Delete your note/ }))

    await waitFor(() => expect(screen.queryByText('Strong phone call.')).not.toBeInTheDocument())
    expect(rpc.deleteNote).not.toHaveBeenCalled()
    toast.show.mock.calls.at(-1)?.[0]?.onClose()
    await waitFor(() => expect(rpc.deleteNote).toHaveBeenCalledWith('note-1'))
  })

  it('offers to reopen a rejection and shows why the team passed', async () => {
    rpc.reopenApplication.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderView({
      ...DETAIL,
      summary: { ...DETAIL.summary, status: 'rejected' },
      rejectionReason: 'Needs a current licence',
    })

    expect(screen.getByText('Needs a current licence')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Move to a stage' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reopen' }))
    expect(await screen.findByText('Stage: Screening')).toBeInTheDocument()
  })
})
