import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { CorrectionRequestModal } from './correction-request-modal'

const rpc = vi.hoisted(() => ({ requestCorrection: vi.fn(), listCorrections: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const MISSED_DAY = {
  workDate: '2026-09-22',
  clockInTime: '09:00',
  clockOutTime: '',
  breakMinutes: 30,
  reason: '',
}

function open(onClose = vi.fn()) {
  render(
    <CorrectionRequestModal opened onClose={onClose} initial={MISSED_DAY} today="2026-09-24" />,
  )
  return onClose
}

describe('CorrectionRequestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listCorrections.mockResolvedValue([])
    rpc.requestCorrection.mockResolvedValue({ id: 'corr-1' })
  })

  it('starts from the day as it was recorded', () => {
    open()

    expect(screen.getByLabelText(/^Day/)).toHaveValue('2026-09-22')
    expect(screen.getByLabelText(/Clocked in/)).toHaveValue('09:00')
    expect(screen.getByLabelText(/Break time/)).toHaveValue('30 min')
  })

  it('asks for the clock-out and what happened before sending', async () => {
    const user = userEvent.setup()
    open()

    await user.click(screen.getByRole('button', { name: 'Send request' }))

    expect(
      await screen.findByText('Say what happened, so the admin can check it.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Use a time like 09:00.')).toBeInTheDocument()
    expect(rpc.requestCorrection).not.toHaveBeenCalled()
  })

  it('sends the day as the member remembers it, then closes', async () => {
    const user = userEvent.setup()
    const onClose = open()

    await user.type(screen.getByLabelText(/Clocked out/), '18:00')
    await user.type(screen.getByLabelText(/What happened/), 'Forgot to clock out.')
    await user.click(screen.getByRole('button', { name: 'Send request' }))

    await waitFor(() =>
      expect(rpc.requestCorrection).toHaveBeenCalledWith({
        workDate: '2026-09-22',
        clockInTime: '09:00',
        clockOutTime: '18:00',
        breakMinutes: 30,
        reason: 'Forgot to clock out.',
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('keeps what was typed and says why when the server refuses', async () => {
    rpc.requestCorrection.mockRejectedValue(
      new Error('You already asked about that day. Withdraw that request to send a different one.'),
    )
    const user = userEvent.setup()
    const onClose = open()

    await user.type(screen.getByLabelText(/Clocked out/), '18:00')
    await user.type(screen.getByLabelText(/What happened/), 'Forgot to clock out.')
    await user.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByText(/You already asked about that day/)).toBeInTheDocument()
    expect(screen.getByLabelText(/What happened/)).toHaveValue('Forgot to clock out.')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('has no axe violations', async () => {
    const { container } = render(
      <CorrectionRequestModal opened onClose={vi.fn()} initial={MISSED_DAY} today="2026-09-24" />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
