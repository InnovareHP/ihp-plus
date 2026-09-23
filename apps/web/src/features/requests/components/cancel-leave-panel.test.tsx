import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { RequestRow } from '../schema'
import { CancelLeavePanel } from './cancel-leave-panel'

const rpc = vi.hoisted(() => ({ cancelRequest: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const ROW: RequestRow = {
  id: 'sub-1',
  formId: 'form-1',
  formName: 'Vacation leave',
  fields: [],
  values: {},
  requesterId: 'user-9',
  requesterName: 'Grace',
  teamName: 'Revenue Cycle',
  status: 'approved',
  decidedBy: 'Ada',
  decidedAt: '2026-09-02T00:00:00.000Z',
  decisionNote: undefined,
  createdAt: '2026-09-01T00:00:00.000Z',
  canDecide: false,
  isMine: false,
  canCancel: true,
  timeOff: true,
  cancelledBy: undefined,
  cancelledAt: undefined,
  cancellationNote: undefined,
}

const user = () => userEvent.setup()

describe('CancelLeavePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.cancelRequest.mockResolvedValue({ ...ROW, status: 'cancelled', canCancel: false })
  })

  it('asks for the reason before cancelling', async () => {
    const person = user()
    render(<CancelLeavePanel row={ROW} />)

    await person.click(screen.getByRole('button', { name: "Cancel Grace's leave" }))

    expect(
      await screen.findByText(
        'Say why the leave is cancelled, so the requester knows what changed.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Reason/)).toHaveAttribute('aria-invalid', 'true')
    expect(rpc.cancelRequest).not.toHaveBeenCalled()
  })

  it('cancels with the reason given', async () => {
    const person = user()
    render(<CancelLeavePanel row={ROW} />)

    await person.type(screen.getByLabelText(/Reason/), 'The audit moved to that week.')
    await person.click(screen.getByRole('button', { name: "Cancel Grace's leave" }))

    await waitFor(() =>
      expect(rpc.cancelRequest).toHaveBeenCalledWith({
        submissionId: 'sub-1',
        note: 'The audit moved to that week.',
      }),
    )
  })

  it('keeps the reason and shows why when the server refuses', async () => {
    rpc.cancelRequest.mockRejectedValue(new Error('Only approved time off can be cancelled.'))
    const person = user()
    render(<CancelLeavePanel row={ROW} />)

    await person.type(screen.getByLabelText(/Reason/), 'The audit moved.')
    await person.click(screen.getByRole('button', { name: "Cancel Grace's leave" }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only approved time off can be cancelled.',
    )
    expect(screen.getByLabelText(/Reason/)).toHaveValue('The audit moved.')
  })

  it('has no axe violations', async () => {
    const { container } = render(<CancelLeavePanel row={ROW} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
