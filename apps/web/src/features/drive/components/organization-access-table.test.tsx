import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent, waitFor, within } from '@/test/render'

const actions = vi.hoisted(() => ({
  listOrganizationAccess: vi.fn(),
  revokeClientFolderAccess: vi.fn(),
}))

// Spelled out rather than imported: vi.hoisted runs before the module graph is ready.
const DEFAULT_QUERY = {
  page: 1,
  pageSize: 25,
  search: '',
  view: 'active',
  sortBy: 'invitedAt',
  sortDirection: 'desc',
} as const

const urlQuery = vi.hoisted(() => ({
  query: {
    page: 1,
    pageSize: 25,
    search: '',
    view: 'active',
    sortBy: 'invitedAt',
    sortDirection: 'desc',
  } as (typeof import('../schema'))['DEFAULT_ORGANIZATION_ACCESS_QUERY'],
  setQuery: vi.fn(),
  clearFilters: vi.fn(),
}))

const announce = vi.hoisted(() => ({ announceFailure: vi.fn(), announceSuccess: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('../hooks/use-organization-access-query', () => ({
  useOrganizationAccessQuery: () => urlQuery,
}))
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('@/lib/announce', () => announce)

const { OrganizationAccessTable } = await import('./organization-access-table')

const PAGE_INFO = {
  page: 1,
  pageSize: 25,
  total: 1,
  pageCount: 1,
  hasPrevious: false,
  hasNext: false,
}

const ROW = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'buyer@acme.test',
  role: 'read',
  clientId: '11111111-1111-4111-8111-111111111111',
  clientName: 'Acme',
  folderUrl: 'https://sharepoint.test/Acme',
  invitedAt: '2026-03-04T10:00:00.000Z',
  revokedAt: undefined,
}

beforeEach(() => {
  vi.clearAllMocks()
  urlQuery.query = { ...DEFAULT_QUERY }
  actions.listOrganizationAccess.mockResolvedValue({ ok: true, rows: [ROW], pageInfo: PAGE_INFO })
  actions.revokeClientFolderAccess.mockResolvedValue({
    ok: true,
    data: { ...ROW, revokedAt: '2026-03-05T10:00:00.000Z' },
  })
})

describe('OrganizationAccessTable', () => {
  it('lists every grant with the client folder it is on', async () => {
    render(<OrganizationAccessTable />)

    const row = await screen.findByRole('row', { name: /buyer@acme.test/ })
    expect(within(row).getByRole('link', { name: 'Acme' })).toHaveAttribute(
      'href',
      'https://sharepoint.test/Acme',
    )
    expect(within(row).getByText('Can read')).toBeInTheDocument()
  })

  it('asks the server for the filters the URL carries', async () => {
    urlQuery.query = { ...DEFAULT_QUERY, search: 'acme', view: 'removed' }
    render(<OrganizationAccessTable />)

    await waitFor(() =>
      expect(actions.listOrganizationAccess).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'acme', view: 'removed' }),
      ),
    )
  })

  it('puts a switched view in the URL instead of narrowing in place', async () => {
    const user = userEvent.setup()
    render(<OrganizationAccessTable />)

    await screen.findByText('buyer@acme.test')
    await user.click(screen.getByRole('radio', { name: 'Removed' }))

    expect(urlQuery.setQuery).toHaveBeenCalledWith({ view: 'removed' })
  })

  it('removes access immediately, before the server answers', async () => {
    const user = userEvent.setup()
    actions.revokeClientFolderAccess.mockReturnValue(new Promise(() => {}))
    render(<OrganizationAccessTable />)

    await user.click(await screen.findByRole('button', { name: 'Remove access' }))

    // Scoped to the row: the view switcher carries a "Removed" label of its own.
    const row = await screen.findByRole('row', { name: /buyer@acme.test/ })
    expect(within(row).getByText(/^Removed /)).toBeInTheDocument()
  })

  it('puts the grant back and announces it when the revoke fails', async () => {
    const user = userEvent.setup()
    actions.revokeClientFolderAccess.mockResolvedValue({
      ok: false,
      message: 'Could not remove that access — try again.',
    })
    render(<OrganizationAccessTable />)

    await user.click(await screen.findByRole('button', { name: 'Remove access' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove access' })).toBeInTheDocument(),
    )
    expect(announce.announceFailure).toHaveBeenCalledWith(
      'Could not remove that access — try again.',
    )
  })

  it('names the benefit when nothing has been shared yet', async () => {
    actions.listOrganizationAccess.mockResolvedValue({
      ok: true,
      rows: [],
      pageInfo: { ...PAGE_INFO, total: 0 },
    })
    render(<OrganizationAccessTable />)

    expect(
      await screen.findByText('Nobody outside the company can open a client folder'),
    ).toBeInTheDocument()
  })

  it('keeps a way back when a filter is what emptied the table', async () => {
    urlQuery.query = { ...DEFAULT_QUERY, search: 'nobody' }
    actions.listOrganizationAccess.mockResolvedValue({
      ok: true,
      rows: [],
      pageInfo: { ...PAGE_INFO, total: 0 },
    })
    render(<OrganizationAccessTable />)

    expect(await screen.findByText('No access matches those filters')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('says what went wrong and offers a retry', async () => {
    actions.listOrganizationAccess.mockResolvedValue({
      ok: false,
      message: 'Only an admin can see every folder grant.',
    })
    render(<OrganizationAccessTable />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only an admin can see every folder grant.',
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<OrganizationAccessTable />)

    await screen.findByText('buyer@acme.test')

    expect(await axe(container)).toHaveNoViolations()
  })
})
