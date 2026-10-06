import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { LeaveBalance, PersonBalances, TeamLeaveBalances } from '../schema'
import { TeamLeavePanel } from './team-leave-panel'

const rpc = vi.hoisted(() => ({ listTeamBalances: vi.fn(), setAllowance: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: toast }))

const VACATION: LeaveBalance = {
  formId: 'form-1',
  formName: 'Vacation leave',
  allowance: 15,
  used: 4,
  pending: 1,
  remaining: 11,
  overridden: false,
}

const ADA: PersonBalances = { userId: 'user-1', name: 'Ada Lovelace', balances: [VACATION] }

const TEAM: TeamLeaveBalances = {
  year: 2026,
  forms: [{ formId: 'form-1', formName: 'Vacation leave', allowance: 15 }],
  people: [ADA],
}

const EDIT = 'Change Ada Lovelace’s Vacation leave allowance'

beforeEach(() => {
  vi.clearAllMocks()
  rpc.listTeamBalances.mockResolvedValue(TEAM)
})

function adaRow() {
  return screen.getByRole('row', { name: /Ada Lovelace/ })
}

async function setDays(user: ReturnType<typeof userEvent.setup>, days: string) {
  await user.click(await screen.findByRole('button', { name: EDIT }))
  const input = await screen.findByRole('textbox', { name: 'Days per year' })
  await user.clear(input)
  await user.type(input, days)
  await user.click(screen.getByRole('button', { name: 'Save allowance' }))
}

describe('TeamLeavePanel', () => {
  it('lists each person’s days left per form', async () => {
    const { container } = render(<TeamLeavePanel year={2026} />)

    expect(await screen.findByRole('table', { name: 'Leave balances by person' })).toBeVisible()
    expect(adaRow()).toHaveTextContent('11 of 15 left')
    expect(adaRow()).toHaveTextContent('4 used · 1 pending')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows a new allowance before the server answers', async () => {
    let finish: (value: unknown) => void = () => {}
    rpc.setAllowance.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const user = userEvent.setup()
    render(<TeamLeavePanel year={2026} />)

    await setDays(user, '20')

    expect(rpc.setAllowance).toHaveBeenCalledWith({ formId: 'form-1', userId: 'user-1', days: 20 })
    expect(within(adaRow()).getByText('16 of 20 left')).toBeInTheDocument()
    expect(adaRow()).toHaveTextContent('(own)')
    finish(ADA)
  })

  it('puts the old allowance back and says why when saving fails', async () => {
    rpc.setAllowance.mockRejectedValue(new Error('Only an admin can see everyone’s leave.'))
    const user = userEvent.setup()
    render(<TeamLeavePanel year={2026} />)

    await setDays(user, '20')

    await waitFor(() => expect(adaRow()).toHaveTextContent('11 of 15 left'))
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Could not save the allowance — Only an admin can see everyone’s leave.',
        autoClose: false,
      }),
    )
  })

  it('refuses an empty allowance and announces why', async () => {
    const user = userEvent.setup()
    render(<TeamLeavePanel year={2026} />)

    await user.click(await screen.findByRole('button', { name: EDIT }))
    await user.clear(await screen.findByRole('textbox', { name: 'Days per year' }))
    await user.click(screen.getByRole('button', { name: 'Save allowance' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a number of days.')
    expect(rpc.setAllowance).not.toHaveBeenCalled()
  })

  it('puts a person back on the form’s allowance', async () => {
    rpc.listTeamBalances.mockResolvedValue({
      ...TEAM,
      people: [{ ...ADA, balances: [{ ...VACATION, allowance: 20, overridden: true }] }],
    })
    rpc.setAllowance.mockResolvedValue(ADA)
    const user = userEvent.setup()
    render(<TeamLeavePanel year={2026} />)

    await user.click(await screen.findByRole('button', { name: EDIT }))
    await user.click(screen.getByRole('button', { name: 'Use the form’s 15 days' }))

    expect(rpc.setAllowance).toHaveBeenCalledWith({
      formId: 'form-1',
      userId: 'user-1',
      days: undefined,
    })
  })

  it('closes the editor with Escape and leaves the allowance alone', async () => {
    const user = userEvent.setup()
    render(<TeamLeavePanel year={2026} />)

    await user.click(await screen.findByRole('button', { name: EDIT }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpc.setAllowance).not.toHaveBeenCalled()
  })

  it('points to the forms when none tracks an allowance', async () => {
    rpc.listTeamBalances.mockResolvedValue({ year: 2026, forms: [], people: [] })
    render(<TeamLeavePanel year={2026} />)

    expect(await screen.findByText('No form tracks an allowance yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open request forms' })).toBeInTheDocument()
  })
})
