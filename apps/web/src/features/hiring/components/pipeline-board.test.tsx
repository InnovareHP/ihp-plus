import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { DEFAULT_STAGES, type ApplicationSummary, type PostingRow } from '../schema'
import { PipelineBoard } from './pipeline-board'

const rpc = vi.hoisted(() => ({
  listPipeline: vi.fn(),
  moveApplication: vi.fn(),
  rejectApplication: vi.fn(),
  reopenApplication: vi.fn(),
}))
const toast = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: toast }))

const POSTING = {
  id: 'post-1',
  slug: 'registered-nurse-abc123',
  title: 'Registered nurse',
  status: 'open',
  stages: [...DEFAULT_STAGES],
} as PostingRow

const GRACE: ApplicationSummary = {
  id: 'app-1',
  postingId: 'post-1',
  postingTitle: 'Registered nurse',
  fullName: 'Grace Hopper',
  email: 'grace@example.com',
  phone: '',
  status: 'active',
  stageId: 'applied',
  stageName: 'Applied',
  stageChangedAt: new Date().toISOString(),
  createdAt: '2026-09-20T10:00:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
  hasResume: true,
}

const ADA: ApplicationSummary = {
  ...GRACE,
  id: 'app-2',
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  stageId: 'screening',
  stageName: 'Screening',
}

function column(name: string) {
  return screen.getByRole('region', { name })
}

async function openMenuFor(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
}

beforeEach(() => {
  vi.clearAllMocks()
  rpc.listPipeline.mockResolvedValue([GRACE, ADA])
})

describe('PipelineBoard', () => {
  it('shows one column per stage with who is in it', async () => {
    const { container } = render(<PipelineBoard posting={POSTING} rejectionMessage="Thanks." />)

    await screen.findByText('Grace Hopper')
    expect(within(column('Applied')).getByText('Grace Hopper')).toBeInTheDocument()
    expect(within(column('Screening')).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(column('Offer')).getByText('Nobody here right now.')).toBeInTheDocument()
    expect(screen.getByLabelText('1 in Applied')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('says how to fill an empty pipeline', async () => {
    rpc.listPipeline.mockResolvedValue([])
    render(<PipelineBoard posting={POSTING} rejectionMessage="Thanks." />)

    expect(await screen.findByText('Nobody in the pipeline yet')).toBeInTheDocument()
  })

  it('moves a card to a quiet stage before the server answers', async () => {
    rpc.moveApplication.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<PipelineBoard posting={POSTING} rejectionMessage="Thanks." />)

    await openMenuFor(user, 'Grace Hopper')
    await user.click(await screen.findByRole('menuitem', { name: 'Screening' }))

    await waitFor(() =>
      expect(within(column('Screening')).getByText('Grace Hopper')).toBeInTheDocument(),
    )
    expect(rpc.moveApplication).toHaveBeenCalledWith({
      applicationId: 'app-1',
      stageId: 'screening',
      sendEmail: false,
      message: '',
    })
  })

  it('puts the card back and says why when the move fails', async () => {
    rpc.moveApplication.mockRejectedValue(new Error('That stage is no longer on this posting.'))
    const user = userEvent.setup()
    render(<PipelineBoard posting={POSTING} rejectionMessage="Thanks." />)

    await openMenuFor(user, 'Grace Hopper')
    await user.click(await screen.findByRole('menuitem', { name: 'Screening' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'That stage is no longer on this posting.' }),
      ),
    )
    expect(within(column('Applied')).getByText('Grace Hopper')).toBeInTheDocument()
  })

  it('shows the email before moving someone into a stage that sends one', async () => {
    rpc.moveApplication.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<PipelineBoard posting={POSTING} rejectionMessage="Thanks." />)

    await openMenuFor(user, 'Grace Hopper')
    await user.click(await screen.findByRole('menuitem', { name: /Interview/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Move Grace Hopper to Interview' })

    expect(within(dialog).getByLabelText(/^Message/)).toHaveValue(DEFAULT_STAGES[2]?.message)
    expect(rpc.moveApplication).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Move and email Grace' }))
    await waitFor(() =>
      expect(rpc.moveApplication).toHaveBeenCalledWith(
        expect.objectContaining({ stageId: 'interview', sendEmail: true }),
      ),
    )
  })

  it('takes a rejected card off at once and only tells the server when undo is passed up', async () => {
    rpc.rejectApplication.mockResolvedValue({ ...GRACE, status: 'rejected' })
    const user = userEvent.setup()
    render(<PipelineBoard posting={POSTING} rejectionMessage="Thank you for applying." />)

    await openMenuFor(user, 'Grace Hopper')
    await user.click(await screen.findByRole('menuitem', { name: 'Not moving forward' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Not moving forward with Grace Hopper?',
    })
    expect(within(dialog).getByLabelText(/^Message/)).toHaveValue('Thank you for applying.')
    await user.click(within(dialog).getByRole('button', { name: 'Not moving forward' }))

    await waitFor(() => expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument())
    expect(rpc.rejectApplication).not.toHaveBeenCalled()

    toast.show.mock.calls.at(-1)?.[0]?.onClose()
    await waitFor(() =>
      expect(rpc.rejectApplication).toHaveBeenCalledWith({
        applicationId: 'app-1',
        reason: '',
        sendEmail: true,
        message: 'Thank you for applying.',
      }),
    )
  })
})
