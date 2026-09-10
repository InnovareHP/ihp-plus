import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { InvitationsPanel } from './invitations-panel'

const actions = vi.hoisted(() => ({
  listInvitations: vi.fn(),
  inviteMember: vi.fn(),
  cancelInvitation: vi.fn(),
  resendInvitation: vi.fn(),
  listTeams: vi.fn(),
  listAssignableUsers: vi.fn(),
  listTeamMembers: vi.fn(),
  createTeam: vi.fn(),
  renameTeam: vi.fn(),
  deleteTeam: vi.fn(),
  assignDepartment: vi.fn(),
  removeFromTeam: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const TEAM = { id: 'team-1', name: 'Finance', memberCount: 2, createdAt: '2026-01-04T00:00:00Z' }

const PENDING = {
  id: 'invite-1',
  email: 'ada@innovarehp.com',
  role: 'member',
  teamName: 'Finance',
  status: 'pending' as const,
  expiresAt: '2026-09-20T12:00:00Z',
  expired: false,
  invitedBy: 'Grace Hopper',
}

const user = () => userEvent.setup()

async function pickDepartment(person: ReturnType<typeof user>) {
  await person.click(await screen.findByRole('combobox', { name: /Department/ }))
  await person.click(await screen.findByRole('option', { name: 'Finance' }))
}

describe('InvitationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.listInvitations.mockResolvedValue({ ok: true, data: [PENDING] })
    actions.listTeams.mockResolvedValue({ ok: true, data: [TEAM] })
    actions.inviteMember.mockResolvedValue({ ok: true })
    actions.cancelInvitation.mockResolvedValue({ ok: true })
    actions.resendInvitation.mockResolvedValue({ ok: true })
  })

  it('lists a pending invitation with who sent it and where it lands', async () => {
    render(<InvitationsPanel invitedBy="Grace Hopper" />)

    const row = await screen.findByRole('row', { name: /ada@innovarehp.com/ })
    expect(within(row).getByText('by Grace Hopper')).toBeInTheDocument()
    expect(within(row).getByText('Finance')).toBeInTheDocument()
  })

  it('rejects an address that is not an email before the server sees it', async () => {
    const person = user()
    render(<InvitationsPanel invitedBy="Grace Hopper" />)

    await person.type(await screen.findByLabelText(/Work email/), 'not-an-email')
    await person.click(screen.getByRole('button', { name: 'Send invite' }))

    expect(await screen.findByText('Enter a work email address.')).toBeInTheDocument()
    expect(actions.inviteMember).not.toHaveBeenCalled()
  })

  it('requires a department so nobody is invited into nothing', async () => {
    const person = user()
    render(<InvitationsPanel invitedBy="Grace Hopper" />)

    await person.type(await screen.findByLabelText(/Work email/), 'grace@innovarehp.com')
    await person.click(screen.getByRole('button', { name: 'Send invite' }))

    expect(await screen.findByText('Pick the department they will join.')).toBeInTheDocument()
    expect(actions.inviteMember).not.toHaveBeenCalled()
  })

  it('shows the invitation in the table before the server answers', async () => {
    let resolve: (value: { ok: true }) => void = () => {}
    actions.inviteMember.mockReturnValue(
      new Promise<{ ok: true }>((settle) => {
        resolve = settle
      }),
    )
    const person = user()
    render(<InvitationsPanel invitedBy="Grace Hopper" />)

    await person.type(await screen.findByLabelText(/Work email/), 'grace@innovarehp.com')
    await pickDepartment(person)
    await person.click(screen.getByRole('button', { name: 'Send invite' }))

    // Optimistic: the row is listed while the action is still pending.
    expect(await screen.findByText('grace@innovarehp.com')).toBeInTheDocument()
    resolve({ ok: true })
  })

  it('restores the list and announces it when the invitation is refused', async () => {
    actions.inviteMember.mockResolvedValue({
      ok: false,
      message: 'That person is already in this organization.',
    })
    const person = user()
    render(<InvitationsPanel invitedBy="Grace Hopper" />)

    await person.type(await screen.findByLabelText(/Work email/), 'grace@innovarehp.com')
    await pickDepartment(person)
    await person.click(screen.getByRole('button', { name: 'Send invite' }))

    await waitFor(() => expect(actions.inviteMember).toHaveBeenCalled())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That person is already in this organization.',
    )
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'red',
        autoClose: false,
        message: 'That person is already in this organization.',
      }),
    )
    await waitFor(() => expect(screen.queryByText('grace@innovarehp.com')).not.toBeInTheDocument())
  })

  it('drops a cancelled invitation from the table immediately', async () => {
    let resolve: (value: { ok: true }) => void = () => {}
    actions.cancelInvitation.mockReturnValue(
      new Promise<{ ok: true }>((settle) => {
        resolve = settle
      }),
    )
    const person = user()
    render(<InvitationsPanel invitedBy="Grace Hopper" />)

    await person.click(
      await screen.findByRole('button', { name: 'Cancel the invitation to ada@innovarehp.com' }),
    )

    await waitFor(() => expect(screen.queryByText('ada@innovarehp.com')).not.toBeInTheDocument())
    resolve({ ok: true })
  })

  it('resends an invitation and says so', async () => {
    const person = user()
    render(<InvitationsPanel invitedBy="Grace Hopper" />)

    await person.click(
      await screen.findByRole('button', { name: 'Resend the invitation to ada@innovarehp.com' }),
    )

    await waitFor(() =>
      expect(actions.resendInvitation).toHaveBeenCalledWith({ invitationId: 'invite-1' }),
    )
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invitation resent to ada@innovarehp.com.' }),
    )
  })

  it('explains an empty table instead of showing bare headings', async () => {
    actions.listInvitations.mockResolvedValue({ ok: true, data: [] })
    render(<InvitationsPanel invitedBy="Grace Hopper" />)

    expect(await screen.findByText('No invitations waiting')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<InvitationsPanel invitedBy="Grace Hopper" />)
    await screen.findByText('ada@innovarehp.com')
    expect(await axe(container)).toHaveNoViolations()
  })
})
