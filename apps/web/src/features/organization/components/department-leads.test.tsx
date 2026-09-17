import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { DepartmentLeads } from './department-leads'

const actions = vi.hoisted(() => ({
  listDepartmentLeads: vi.fn(),
  addDepartmentLead: vi.fn(),
  removeDepartmentLead: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('@/features/teams/actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const VIEW = {
  teams: [
    { id: 'team-1', name: 'Finance' },
    { id: 'team-2', name: 'Executive' },
  ],
  members: [
    { id: 'user-1', name: 'Ada Lovelace', email: 'ada@innovarehp.com' },
    { id: 'user-2', name: 'Grace Hopper', email: 'grace@innovarehp.com' },
  ],
  leads: [{ teamId: 'team-1', userId: 'user-1' }],
}

const user = () => userEvent.setup()

function renderLeads({ teamId = 'team-1', canEdit = true } = {}) {
  return render(
    <DepartmentLeads
      teamId={teamId}
      teamName={teamId === 'team-1' ? 'Finance' : 'Executive'}
      canEdit={canEdit}
    />,
  )
}

describe('DepartmentLeads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.listDepartmentLeads.mockResolvedValue({ ok: true, data: VIEW })
    actions.addDepartmentLead.mockResolvedValue({ ok: true })
    actions.removeDepartmentLead.mockResolvedValue({ ok: true })
  })

  it('names the leads of this department and nobody else', async () => {
    renderLeads()

    // Scoped to the badges: Grace is a candidate in the picker, just not a lead here.
    const badge = await screen.findByText('Ada Lovelace')
    expect(badge).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Remove Grace Hopper as a lead/ }),
    ).not.toBeInTheDocument()
  })

  it('says so when a department has no lead', async () => {
    renderLeads({ teamId: 'team-2' })

    expect(await screen.findByText('Nobody leads Executive yet.')).toBeInTheDocument()
  })

  it('appoints someone who is not already a lead here', async () => {
    const person = user()
    renderLeads()

    await person.click(await screen.findByRole('combobox', { name: 'Add a lead for Finance' }))
    await person.click(await screen.findByRole('option', { name: 'Grace Hopper' }))
    await person.click(screen.getByRole('button', { name: 'Add lead' }))

    await waitFor(() =>
      expect(actions.addDepartmentLead).toHaveBeenCalledWith({
        teamId: 'team-1',
        userId: 'user-2',
      }),
    )
  })

  it('offers nobody who already leads this department', async () => {
    const person = user()
    renderLeads()

    await person.click(await screen.findByRole('combobox', { name: 'Add a lead for Finance' }))

    expect(await screen.findByRole('option', { name: 'Grace Hopper' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Ada Lovelace' })).not.toBeInTheDocument()
  })

  it('removes a lead by name', async () => {
    const person = user()
    renderLeads()

    await person.click(
      await screen.findByRole('button', { name: 'Remove Ada Lovelace as a lead of Finance' }),
    )

    await waitFor(() =>
      expect(actions.removeDepartmentLead).toHaveBeenCalledWith({
        teamId: 'team-1',
        userId: 'user-1',
      }),
    )
  })

  it('announces a refusal rather than failing silently', async () => {
    actions.removeDepartmentLead.mockResolvedValue({
      ok: false,
      message: 'Only an admin can change who leads a department.',
    })
    const person = user()
    renderLeads()

    await person.click(
      await screen.findByRole('button', { name: 'Remove Ada Lovelace as a lead of Finance' }),
    )

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'red',
          autoClose: false,
          message: 'Only an admin can change who leads a department.',
        }),
      ),
    )
  })

  it('shows the leads but offers no editing to someone who cannot manage', async () => {
    renderLeads({ canEdit: false })

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove Ada Lovelace/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add lead' })).not.toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = renderLeads()
    await screen.findByText('Ada Lovelace')
    expect(await axe(container)).toHaveNoViolations()
  })
})
