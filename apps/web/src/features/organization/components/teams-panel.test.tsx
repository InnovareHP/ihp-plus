import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { TeamsPanel } from './teams-panel'

const actions = vi.hoisted(() => ({
  listTeams: vi.fn(),
  createTeam: vi.fn(),
  renameTeam: vi.fn(),
  deleteTeam: vi.fn(),
  listTeamMembers: vi.fn(),
  listAssignableUsers: vi.fn(),
  assignDepartment: vi.fn(),
  removeFromTeam: vi.fn(),
}))

const nav = vi.hoisted(() => ({ replace: vi.fn(), searchParams: new URLSearchParams() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => nav.searchParams,
  usePathname: () => '/organization/teams',
}))

const FINANCE = { id: 'team-1', name: 'Finance', memberCount: 2, createdAt: '2026-01-04T00:00:00Z' }
const IT = {
  id: 'team-2',
  name: 'Information Technology',
  memberCount: 0,
  createdAt: '2026-02-11T00:00:00Z',
}

const user = () => userEvent.setup()

describe('TeamsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.searchParams = new URLSearchParams()
    actions.listTeams.mockResolvedValue({ ok: true, data: [FINANCE, IT] })
    actions.createTeam.mockResolvedValue({ ok: true })
    actions.renameTeam.mockResolvedValue({ ok: true })
    actions.deleteTeam.mockResolvedValue({ ok: true })
    actions.listAssignableUsers.mockResolvedValue({ ok: true, data: [] })
    actions.listTeamMembers.mockResolvedValue({ ok: true, data: [] })
  })

  it('lists each department with how many people are in it', async () => {
    render(<TeamsPanel />)

    expect(await screen.findByText('Finance')).toBeInTheDocument()
    const row = screen.getByRole('row', { name: /Finance/ })
    expect(within(row).getByText('2')).toBeInTheDocument()
  })

  it('shows a new department before the server answers and keeps the list sorted', async () => {
    let resolve: (value: { ok: true }) => void = () => {}
    actions.createTeam.mockReturnValue(
      new Promise<{ ok: true }>((settle) => {
        resolve = settle
      }),
    )
    const person = user()
    render(<TeamsPanel />)

    await person.click(await screen.findByRole('button', { name: 'New department' }))
    await person.type(screen.getByLabelText(/Department name/), 'Care Management')
    await person.click(screen.getByRole('button', { name: 'Create department' }))

    // Optimistic: the row is in the table while the action is still pending.
    expect(await screen.findByText('Care Management')).toBeInTheDocument()
    resolve({ ok: true })
  })

  it('restores the list and announces it when creating fails', async () => {
    actions.createTeam.mockResolvedValue({
      ok: false,
      message: 'A department with that name already exists.',
    })
    const person = user()
    render(<TeamsPanel />)

    await person.click(await screen.findByRole('button', { name: 'New department' }))
    await person.type(screen.getByLabelText(/Department name/), 'Finance')
    await person.click(screen.getByRole('button', { name: 'Create department' }))

    await waitFor(() => expect(actions.createTeam).toHaveBeenCalled())
    expect(
      await screen.findByText('A department with that name already exists.'),
    ).toBeInTheDocument()
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'red',
        autoClose: false,
        message: 'A department with that name already exists.',
      }),
    )
  })

  it('rejects a name that is too short instead of calling the server', async () => {
    const person = user()
    render(<TeamsPanel />)

    await person.click(await screen.findByRole('button', { name: 'New department' }))
    await person.type(screen.getByLabelText(/Department name/), 'A')
    await person.click(screen.getByRole('button', { name: 'Create department' }))

    expect(await screen.findByText('Give the department a name.')).toBeInTheDocument()
    expect(actions.createTeam).not.toHaveBeenCalled()
  })

  it('names the department in the delete confirmation and its button', async () => {
    const person = user()
    render(<TeamsPanel />)

    await person.click(await screen.findByRole('button', { name: 'Actions for Finance' }))
    await person.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    expect(await screen.findByText(/Deleting Finance cannot be undone/)).toBeInTheDocument()
    await person.click(screen.getByRole('button', { name: 'Delete department' }))

    await waitFor(() => expect(actions.deleteTeam).toHaveBeenCalledWith({ teamId: FINANCE.id }))
  })

  it('puts the search term in the URL rather than local state', async () => {
    const person = user()
    render(<TeamsPanel />)

    await person.type(await screen.findByRole('searchbox', { name: 'Search departments' }), 'fin')

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('/organization/teams?search=fin', {
        scroll: false,
      }),
    )
  })

  it('offers a way out when a search matches nothing', async () => {
    nav.searchParams = new URLSearchParams('search=payroll')
    render(<TeamsPanel />)

    expect(await screen.findByText('No departments match those filters')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('explains an organization with no departments yet', async () => {
    actions.listTeams.mockResolvedValue({ ok: true, data: [] })
    render(<TeamsPanel />)

    expect(await screen.findByText('No departments yet')).toBeInTheDocument()
  })

  it('offers a retry when the list cannot load', async () => {
    actions.listTeams.mockResolvedValue({ ok: false, message: 'You do not have permission.' })
    render(<TeamsPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<TeamsPanel />)
    await screen.findByText('Finance')
    expect(await axe(container)).toHaveNoViolations()
  })
})
