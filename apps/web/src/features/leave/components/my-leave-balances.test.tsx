import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { MyLeaveBalances } from './my-leave-balances'

const rpc = vi.hoisted(() => ({ listMyBalances: vi.fn() }))
vi.mock('../rpc', () => rpc)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MyLeaveBalances', () => {
  it('shows each kind of leave with the days left, and a balance gone over', async () => {
    rpc.listMyBalances.mockResolvedValue({
      year: 2026,
      balances: [
        {
          formId: 'form-1',
          formName: 'Vacation leave',
          allowance: 15,
          used: 4,
          pending: 2,
          remaining: 11,
          overridden: false,
        },
        {
          formId: 'form-2',
          formName: 'Sick leave',
          allowance: 5,
          used: 6,
          pending: 0,
          remaining: -1,
          overridden: true,
        },
      ],
    })
    const { container } = render(<MyLeaveBalances year={2026} />)

    const vacation = await screen.findByRole('article', { name: 'Vacation leave' })
    expect(vacation).toHaveTextContent('11 days left')
    expect(vacation).toHaveTextContent('4 used of 15 days · 2 waiting for approval')

    const sick = screen.getByRole('article', { name: 'Sick leave' })
    expect(sick).toHaveTextContent('1 day over')
    expect(sick).toHaveTextContent('Your own allowance')
    expect(rpc.listMyBalances).toHaveBeenCalledWith(2026)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('explains an empty page and links to requests', async () => {
    rpc.listMyBalances.mockResolvedValue({ year: 2026, balances: [] })
    render(<MyLeaveBalances year={2026} />)

    expect(await screen.findByText('No leave allowance yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to my requests' })).toBeInTheDocument()
  })

  it('reports a failure and loads again on retry', async () => {
    rpc.listMyBalances.mockRejectedValueOnce(new Error('The server is unavailable.'))
    rpc.listMyBalances.mockResolvedValueOnce({ year: 2026, balances: [] })
    const user = userEvent.setup()
    render(<MyLeaveBalances year={2026} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('The server is unavailable.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No leave allowance yet')).toBeInTheDocument()
  })
})
