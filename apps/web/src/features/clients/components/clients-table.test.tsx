import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { ClientsTable } from './clients-table'

const actions = vi.hoisted(() => ({
  listClients: vi.fn(),
  listClientFilterOptions: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  archiveClient: vi.fn(),
  restoreClient: vi.fn(),
  addClientOptions: vi.fn(),
  archiveClientOption: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/clients',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const RIVERSIDE = {
  id: 'client-1',
  name: 'Riverside Care Center',
  contactName: 'Dana Reyes',
  email: 'dana@riversidecare.example',
  phone: '(609) 555-0134',
  status: 'active' as const,
  type: 'Skilled nursing facility',
  serviceLine: 'Post-acute network',
  source: 'Referral',
  city: 'Trenton',
  state: 'NJ',
  tags: ['Medicare', 'Renewal due'],
  notes: '',
  ownerId: 'user-2',
  ownerName: 'Grace Hopper',
  lastContactAt: '2026-09-07T00:00:00.000Z',
  createdAt: '2026-01-02T00:00:00.000Z',
  archivedAt: undefined,
}

const ONE_PAGE = {
  page: 1,
  pageSize: 25,
  total: 1,
  pageCount: 1,
  hasPrevious: false,
  hasNext: false,
}

const page = (rows: unknown[], pageInfo: Partial<typeof ONE_PAGE> = {}) => ({
  ok: true,
  rows,
  pageInfo: { ...ONE_PAGE, ...pageInfo },
})

const OPTIONS = {
  ok: true,
  data: {
    owners: [{ id: 'user-2', name: 'Grace Hopper' }],
    options: {
      clientType: ['Skilled nursing facility'],
      clientServiceLine: ['Post-acute network'],
      clientSource: ['Referral'],
      clientCity: ['Trenton'],
      clientState: ['NJ'],
      clientTag: ['Medicare'],
    },
  },
}

const user = () => userEvent.setup()

describe('ClientsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.search = ''
    actions.listClients.mockResolvedValue(page([RIVERSIDE]))
    actions.listClientFilterOptions.mockResolvedValue(OPTIONS)
    actions.createClient.mockImplementation(async (values: { name: string }) => ({
      ok: true,
      data: { ...RIVERSIDE, id: 'client-2', name: values.name },
    }))
    actions.updateClient.mockResolvedValue({ ok: true, data: RIVERSIDE })
    actions.archiveClient.mockResolvedValue({ ok: true, data: null })
    actions.restoreClient.mockResolvedValue({ ok: true, data: null })
  })

  it('lists a client with its type, owner, tags and last contact', async () => {
    render(<ClientsTable />)

    expect(await screen.findByText('Riverside Care Center')).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Clients' })
    expect(within(table).getByText('Skilled nursing facility')).toBeInTheDocument()
    expect(within(table).getByText('Grace Hopper')).toBeInTheDocument()
    expect(within(table).getByText('Medicare')).toBeInTheDocument()
    expect(within(table).getByText('Trenton, NJ')).toBeInTheDocument()
  })

  it('asks the server for the filters the URL carries', async () => {
    nav.search = 'statuses=active&types=Hospital&tags=Medicare&view=archived&page=2'
    render(<ClientsTable />)

    await screen.findByText('Riverside Care Center')
    expect(actions.listClients).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: ['active'],
        types: ['Hospital'],
        tags: ['Medicare'],
        view: 'archived',
        page: 2,
      }),
    )
  })

  it('puts a picked filter in the URL instead of narrowing in place', async () => {
    const person = user()
    render(<ClientsTable />)
    await screen.findByText('Riverside Care Center')

    const filters = within(screen.getByRole('search', { name: 'Filter clients' }))
    await person.click(filters.getByRole('combobox', { name: 'Status' }))
    await person.click(screen.getByRole('option', { name: 'On hold' }))

    expect(nav.replace).toHaveBeenCalledWith('/clients?statuses=on_hold', { scroll: false })
  })

  it('shows a new client before the server answers', async () => {
    let resolve: (value: unknown) => void = () => {}
    actions.createClient.mockReturnValue(
      new Promise((settle) => {
        resolve = settle
      }),
    )
    const person = user()
    render(<ClientsTable />)
    await screen.findByText('Riverside Care Center')

    await person.click(screen.getByRole('button', { name: 'New client' }))
    await person.type(screen.getByRole('textbox', { name: /Client name/ }), 'Keystone Behavioral')
    await person.click(screen.getByRole('button', { name: 'Add client' }))

    // Optimistic: the row is on screen while the action is still pending.
    await waitFor(() => expect(screen.getByText('Keystone Behavioral')).toBeInTheDocument())
    resolve({ ok: true, data: { ...RIVERSIDE, id: 'client-2', name: 'Keystone Behavioral' } })
  })

  it('takes the new row back out and announces it when the server refuses', async () => {
    actions.createClient.mockResolvedValue({ ok: false, message: 'That client already exists.' })
    const person = user()
    render(<ClientsTable />)
    await screen.findByText('Riverside Care Center')

    await person.click(screen.getByRole('button', { name: 'New client' }))
    await person.type(screen.getByRole('textbox', { name: /Client name/ }), 'Keystone Behavioral')
    await person.click(screen.getByRole('button', { name: 'Add client' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('That client already exists.'),
    )
    expect(screen.queryAllByText('Keystone Behavioral')).toHaveLength(0)
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'That client already exists.' }),
    )
  })

  it('keeps the form open with its values when validation fails', async () => {
    const person = user()
    render(<ClientsTable />)
    await screen.findByText('Riverside Care Center')

    await person.click(screen.getByRole('button', { name: 'New client' }))
    await person.type(screen.getByRole('textbox', { name: /Client name/ }), 'K')
    await person.click(screen.getByRole('button', { name: 'Add client' }))

    expect(await screen.findByText('Give the client a name.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Client name/ })).toHaveValue('K')
    expect(actions.createClient).not.toHaveBeenCalled()
  })

  it('archives a row immediately and offers undo instead of a confirm dialog', async () => {
    let resolve: (value: unknown) => void = () => {}
    actions.archiveClient.mockReturnValue(
      new Promise((settle) => {
        resolve = settle
      }),
    )
    const person = user()
    render(<ClientsTable />)
    await screen.findByText('Riverside Care Center')

    await person.click(screen.getByRole('button', { name: 'Actions for Riverside Care Center' }))
    await person.click(screen.getByRole('menuitem', { name: 'Archive' }))

    // The row leaves before the server answers, which is what the undo toast pays for.
    await waitFor(() => expect(screen.queryByText('Riverside Care Center')).not.toBeInTheDocument())
    expect(actions.archiveClient).toHaveBeenCalledWith({ id: 'client-1' })

    resolve({ ok: true, data: null })
    await waitFor(() => expect(toast.show).toHaveBeenCalled())

    const undo = toast.show.mock.calls.at(-1)?.[0]
    render(undo.message)
    await person.click(screen.getByRole('button', { name: 'Undo' }))
    expect(actions.restoreClient).toHaveBeenCalledWith({ id: 'client-1' })
  })

  it('separates a filtered dead end from an empty list and offers a way back', async () => {
    nav.search = 'search=nobody'
    actions.listClients.mockResolvedValue(page([], { total: 0 }))
    const person = user()
    render(<ClientsTable />)

    expect(await screen.findByText('No clients match these filters')).toBeInTheDocument()
    await person.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(nav.replace).toHaveBeenCalledWith('/clients', { scroll: false })
  })

  it('invites the first client when the organization has none', async () => {
    actions.listClients.mockResolvedValue(page([], { total: 0 }))
    render(<ClientsTable />)

    expect(await screen.findByText('No clients yet')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<ClientsTable />)
    await screen.findByText('Riverside Care Center')

    expect(await axe(container)).toHaveNoViolations()
  })
})
