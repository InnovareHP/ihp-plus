import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { MemberPaySelect } from './member-pay-select'

const rpc = vi.hoisted(() => ({ listPayTerms: vi.fn(), setPayTerms: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

// Mantine's Select carries a hidden input holding the value beside the one people click.
async function picker() {
  const inputs = await screen.findAllByLabelText('Pay basis for Grace Reyes')
  return inputs.find((input) => input.getAttribute('type') !== 'hidden') as HTMLElement
}

describe('MemberPaySelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listPayTerms.mockResolvedValue([])
    rpc.setPayTerms.mockResolvedValue(undefined)
  })

  it('reads a daily rate for somebody with no terms on file', async () => {
    render(<MemberPaySelect userId="user-1" userName="Grace Reyes" />)

    await waitFor(() => expect(picker()).resolves.toHaveValue('Daily rate'))
  })

  it('shows fixed pay at once and saves it', async () => {
    // Held open so the optimistic value is what the row shows while the server is busy.
    rpc.setPayTerms.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<MemberPaySelect userId="user-1" userName="Grace Reyes" />)
    await waitFor(() => expect(picker()).resolves.toHaveValue('Daily rate'))

    await user.click(await picker())
    await user.click(await screen.findByRole('option', { name: 'Fixed pay' }))

    await waitFor(() => expect(picker()).resolves.toHaveValue('Fixed pay'))
    expect(rpc.setPayTerms).toHaveBeenCalledWith({ userId: 'user-1', fixedPay: true })
  })

  it('snaps back and says why when the server refuses', async () => {
    rpc.setPayTerms.mockRejectedValue(new Error('Only an admin sets how people are paid.'))
    const user = userEvent.setup()
    render(<MemberPaySelect userId="user-1" userName="Grace Reyes" />)
    await waitFor(() => expect(picker()).resolves.toHaveValue('Daily rate'))

    await user.click(await picker())
    await user.click(await screen.findByRole('option', { name: 'Fixed pay' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only an admin sets how people are paid.' }),
      ),
    )
    await waitFor(() => expect(picker()).resolves.toHaveValue('Daily rate'))
  })

  it('has no axe violations', async () => {
    const { container } = render(<MemberPaySelect userId="user-1" userName="Grace Reyes" />)
    await picker()
    expect(await axe(container)).toHaveNoViolations()
  })
})
