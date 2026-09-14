import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { DepartmentApprovers } from './department-approvers'

const requests = vi.hoisted(() => ({ listApprovers: vi.fn(), setApprover: vi.fn() }))
const organization = vi.hoisted(() => ({ listAssignableUsers: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => requests)
vi.mock('@/features/organization/actions', () => organization)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const ADA = { userId: 'user-1', name: 'Ada Lovelace', email: 'ada@innovarehp.com' }

function renderFinance() {
  return render(<DepartmentApprovers teamId="team-1" teamName="Finance" />)
}

describe('DepartmentApprovers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    requests.listApprovers.mockResolvedValue([
      { teamId: 'team-1', teamName: 'Finance', approvers: [ADA] },
    ])
    organization.listAssignableUsers.mockResolvedValue({
      ok: true,
      data: [
        {
          userId: 'user-1',
          name: 'Ada Lovelace',
          email: ADA.email,
          teamId: 'team-1',
          teamName: 'Finance',
        },
        {
          userId: 'user-2',
          name: 'Grace Hopper',
          email: 'grace@innovarehp.com',
          teamId: 'team-2',
          teamName: 'Information Technology',
        },
      ],
    })
  })

  it('names who approves for the department', async () => {
    renderFinance()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
  })

  it('removes an approver at once, before the server answers', async () => {
    requests.setApprover.mockReturnValue(new Promise(() => {}))
    const person = userEvent.setup()
    renderFinance()

    await person.click(
      await screen.findByRole('button', { name: 'Remove Ada Lovelace as an approver for Finance' }),
    )

    expect(requests.setApprover).toHaveBeenCalledWith({
      teamId: 'team-1',
      userId: 'user-1',
      approver: false,
    })
    expect(await screen.findByText('Nobody approves for Finance yet.')).toBeInTheDocument()
  })

  it('only offers people who do not already approve for the department', async () => {
    const person = userEvent.setup()
    renderFinance()

    const picker = await screen.findByRole('combobox', { name: 'Add an approver for Finance' })
    // The picker stays disabled until the people it offers have loaded.
    await waitFor(() => expect(picker).toBeEnabled())
    await person.click(picker)

    expect(
      await screen.findByRole('option', { name: 'Grace Hopper · Information Technology' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Ada Lovelace/ })).not.toBeInTheDocument()
  })

  it('says so when nobody approves for the department yet', async () => {
    requests.listApprovers.mockResolvedValue([])
    renderFinance()

    expect(await screen.findByText('Nobody approves for Finance yet.')).toBeInTheDocument()
  })

  it('shows why the approvers cannot be read', async () => {
    requests.listApprovers.mockRejectedValue(new Error('Only an admin can manage approvers.'))
    renderFinance()

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Only an admin can manage approvers.'),
    )
  })

  it('has no axe violations', async () => {
    const { container } = renderFinance()
    await screen.findByText('Ada Lovelace')

    expect(await axe(container)).toHaveNoViolations()
  })
})
