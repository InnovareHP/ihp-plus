import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { AttendanceCorrectionRow } from '../schema'
import { CorrectionsQueue } from './corrections-queue'

const rpc = vi.hoisted(() => ({ listCorrections: vi.fn(), decideCorrection: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const ADA: AttendanceCorrectionRow = {
  id: 'corr-1',
  userId: 'user-2',
  userName: 'Ada Lovelace',
  workDate: '2026-09-22',
  clockInTime: '09:00',
  clockOutTime: '18:00',
  breakMinutes: 60,
  reason: 'Forgot to clock out.',
  status: 'pending',
  decidedBy: undefined,
  decidedAt: undefined,
  decisionNote: undefined,
  createdAt: '2026-09-23T00:00:00.000Z',
  canDecide: true,
  isMine: false,
}

describe('CorrectionsQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listCorrections.mockResolvedValue([ADA])
    rpc.decideCorrection.mockResolvedValue({ ...ADA, status: 'approved' })
  })

  it('lists what each member asked for and why', async () => {
    render(<CorrectionsQueue />)

    const table = await screen.findByRole('table', { name: 'Correction requests' })
    expect(within(table).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(table).getByText('09:00–18:00, 60 min break')).toBeInTheDocument()
    expect(within(table).getByText('Forgot to clock out.')).toBeInTheDocument()
    expect(screen.getByText('1 waiting')).toBeInTheDocument()
    expect(rpc.listCorrections).toHaveBeenCalledWith({ everyone: true, status: 'pending' })
  })

  it('takes nothing above the timesheet when nobody is waiting', async () => {
    rpc.listCorrections.mockResolvedValue([])
    render(<CorrectionsQueue />)

    await waitFor(() => expect(rpc.listCorrections).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Correction requests' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('takes an approved request off the queue before the server answers', async () => {
    let resolve: (value: unknown) => void = () => {}
    rpc.decideCorrection.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const user = userEvent.setup()
    render(<CorrectionsQueue />)

    await user.click(
      await screen.findByRole('button', { name: /Approve Ada Lovelace's correction/ }),
    )

    await waitFor(() => expect(screen.queryByText('Forgot to clock out.')).not.toBeInTheDocument())
    expect(rpc.decideCorrection).toHaveBeenCalledWith({
      correctionId: 'corr-1',
      decision: 'approved',
      note: '',
    })
    resolve({ ...ADA, status: 'approved' })
  })

  it('puts the request back and says why when the server refuses', async () => {
    rpc.decideCorrection.mockRejectedValue(new Error('That request has already been settled.'))
    rpc.listCorrections.mockResolvedValue([ADA])
    const user = userEvent.setup()
    render(<CorrectionsQueue />)

    await user.click(
      await screen.findByRole('button', { name: /Approve Ada Lovelace's correction/ }),
    )

    expect(await screen.findByText('Forgot to clock out.')).toBeInTheDocument()
    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'That request has already been settled.' }),
      ),
    )
  })

  it('asks for a reason before turning a request down', async () => {
    const user = userEvent.setup()
    render(<CorrectionsQueue />)

    await user.click(
      await screen.findByRole('button', { name: /Turn down Ada Lovelace's correction/ }),
    )
    const dialog = await screen.findByRole('dialog', { name: "Turn down Ada Lovelace's request" })
    await user.click(within(dialog).getByRole('button', { name: 'Turn down request' }))

    expect(
      await within(dialog).findByText(
        'Say why it was turned down, so they know what to do instead.',
      ),
    ).toBeInTheDocument()
    expect(rpc.decideCorrection).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText(/Reason/), 'The door log shows 17:10.')
    await user.click(within(dialog).getByRole('button', { name: 'Turn down request' }))

    await waitFor(() =>
      expect(rpc.decideCorrection).toHaveBeenCalledWith({
        correctionId: 'corr-1',
        decision: 'rejected',
        note: 'The door log shows 17:10.',
      }),
    )
  })

  it('has no axe violations', async () => {
    const { container } = render(<CorrectionsQueue />)
    await screen.findByRole('table', { name: 'Correction requests' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
