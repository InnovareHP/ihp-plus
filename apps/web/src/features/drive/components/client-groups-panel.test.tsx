import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent, waitFor, within } from '@/test/render'

const actions = vi.hoisted(() => ({
  listClientGroups: vi.fn(),
  createClientGroup: vi.fn(),
  addClientToGroup: vi.fn(),
  removeClientFromGroup: vi.fn(),
  deleteClientGroup: vi.fn(),
  listGroupAccess: vi.fn(),
  shareGroupFolder: vi.fn(),
  revokeClientFolderAccess: vi.fn(),
}))

const announce = vi.hoisted(() => ({ announceFailure: vi.fn(), announceSuccess: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('@/lib/announce', () => announce)

const { ClientGroupsPanel } = await import('./client-groups-panel')

const GROUP = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Smith Holdings',
  webUrl: 'https://sharepoint.test/Smith',
  activeGrants: 0,
  members: [{ id: 'c1', name: 'Acme Dental' }],
}

const VIEW = {
  groups: [GROUP],
  clients: [
    { id: 'c1', name: 'Acme Dental', groupId: GROUP.id },
    { id: 'c2', name: 'Acme Ortho', groupId: undefined },
  ],
}

function pending<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.listClientGroups.mockResolvedValue({ ok: true, data: VIEW })
  actions.addClientToGroup.mockResolvedValue({ ok: true, data: null })
  actions.removeClientFromGroup.mockResolvedValue({ ok: true, data: null })
  actions.deleteClientGroup.mockResolvedValue({ ok: true, data: null })
  actions.listGroupAccess.mockResolvedValue({ ok: true, data: [] })
})

describe('ClientGroupsPanel', () => {
  it('lists each group with the companies inside it', async () => {
    render(<ClientGroupsPanel />)

    const card = await screen.findByRole('region', { name: 'Smith Holdings' })
    expect(within(card).getByText('Acme Dental')).toBeInTheDocument()
    expect(within(card).getByText('Not shared with anyone yet.')).toBeInTheDocument()
  })

  it('says how to start when there are no groups', async () => {
    actions.listClientGroups.mockResolvedValue({ ok: true, data: { groups: [], clients: [] } })
    render(<ClientGroupsPanel />)

    expect(await screen.findByText('No client groups yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create group' })).toBeInTheDocument()
  })

  it('offers a retry when the groups cannot load', async () => {
    const user = userEvent.setup()
    actions.listClientGroups.mockResolvedValueOnce({ ok: false, message: 'Database is down.' })
    render(<ClientGroupsPanel />)

    expect(await screen.findByText('Database is down.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('region', { name: 'Smith Holdings' })).toBeInTheDocument()
  })

  it('shows a new group before the server answers', async () => {
    const user = userEvent.setup()
    const create = pending<unknown>()
    actions.createClientGroup.mockReturnValue(create.promise)
    render(<ClientGroupsPanel />)

    await user.type(await screen.findByLabelText(/Group name/), 'Tan Group')
    await user.click(screen.getByRole('button', { name: 'Create group' }))

    expect(await screen.findByRole('heading', { name: 'Tan Group' })).toBeInTheDocument()
    create.resolve({ ok: true, data: { ...GROUP, id: 'g2', name: 'Tan Group', members: [] } })
  })

  it('takes a refused group back out and says why, next to the field', async () => {
    const user = userEvent.setup()
    actions.createClientGroup.mockResolvedValue({
      ok: false,
      message: 'A client already has that name — give the group another one.',
    })
    render(<ClientGroupsPanel />)

    await user.type(await screen.findByLabelText(/Group name/), 'Acme Ortho')
    await user.click(screen.getByRole('button', { name: 'Create group' }))

    expect(
      await screen.findByText('A client already has that name — give the group another one.'),
    ).toBeInTheDocument()
    expect(announce.announceFailure).toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Acme Ortho' })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Group name/)).toHaveValue('Acme Ortho')
  })

  it('asks for a name rather than creating a blank group', async () => {
    const user = userEvent.setup()
    render(<ClientGroupsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Create group' }))

    expect(await screen.findByText('Name the group.')).toBeInTheDocument()
    expect(actions.createClientGroup).not.toHaveBeenCalled()
  })

  it('moves a company into the group at once, and back when the move fails', async () => {
    const user = userEvent.setup()
    const move = pending<unknown>()
    actions.addClientToGroup.mockReturnValue(move.promise)
    render(<ClientGroupsPanel />)

    const card = await screen.findByRole('region', { name: 'Smith Holdings' })
    await user.click(within(card).getByRole('combobox', { name: 'Add a company' }))
    await user.click(await screen.findByRole('option', { name: 'Acme Ortho' }))
    await user.click(within(card).getByRole('button', { name: 'Add company' }))

    expect(
      await within(card).findByRole('button', { name: 'Remove Acme Ortho from Smith Holdings' }),
    ).toBeInTheDocument()

    move.resolve({ ok: false, message: 'Microsoft refused that (nameAlreadyExists) — Taken.' })

    await waitFor(() =>
      expect(
        within(card).queryByRole('button', { name: 'Remove Acme Ortho from Smith Holdings' }),
      ).not.toBeInTheDocument(),
    )
    expect(announce.announceFailure).toHaveBeenCalledWith(
      'Microsoft refused that (nameAlreadyExists) — Taken.',
    )
  })

  it('takes a company out of the group', async () => {
    const user = userEvent.setup()
    render(<ClientGroupsPanel />)

    await user.click(
      await screen.findByRole('button', { name: 'Remove Acme Dental from Smith Holdings' }),
    )

    expect(actions.removeClientFromGroup).toHaveBeenCalledWith({
      groupId: GROUP.id,
      clientId: 'c1',
    })
  })

  it('deletes an empty group only after it is confirmed', async () => {
    const user = userEvent.setup()
    actions.listClientGroups.mockResolvedValue({
      ok: true,
      data: { groups: [{ ...GROUP, members: [], activeGrants: 2 }], clients: [] },
    })
    render(<ClientGroupsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Delete group' }))
    expect(screen.getByText(/The 2 people it is shared with lose the link/)).toBeInTheDocument()
    expect(actions.deleteClientGroup).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete group' }))

    expect(actions.deleteClientGroup).toHaveBeenCalledWith(GROUP.id)
  })

  it('does not offer to delete a group that still holds companies', async () => {
    render(<ClientGroupsPanel />)

    await screen.findByRole('region', { name: 'Smith Holdings' })

    expect(screen.queryByRole('button', { name: 'Delete group' })).not.toBeInTheDocument()
  })

  it('opens the group share with the companies it covers', async () => {
    const user = userEvent.setup()
    render(<ClientGroupsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Share folder' }))

    expect(
      await screen.findByText(/One link opens Acme Dental, and any company added/),
    ).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<ClientGroupsPanel />)

    await screen.findByRole('region', { name: 'Smith Holdings' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
