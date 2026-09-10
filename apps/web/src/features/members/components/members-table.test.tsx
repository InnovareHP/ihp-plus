import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { MembersTable } from './members-table'

const actions = vi.hoisted(() => ({
  listMembers: vi.fn(),
  setOrganizationRole: vi.fn(),
  setPortalRole: vi.fn(),
  setBanned: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/organization/members',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const ADA = {
  memberId: 'member-1',
  userId: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@innovarehp.com',
  organizationRole: 'member' as const,
  portalRole: 'user' as const,
  team: 'Information Technology',
  jobTitle: 'Software Engineer',
  ihpId: 'IHP-0001',
  startDate: '2026-03-04T00:00:00.000Z',
  banned: false,
  isSelf: false,
}

const ONE_PAGE = {
  page: 1,
  pageSize: 25,
  total: 2,
  pageCount: 1,
  hasPrevious: false,
  hasNext: false,
}

const page = (rows: unknown[], pageInfo: Partial<typeof ONE_PAGE> = {}) => ({
  ok: true,
  rows,
  pageInfo: { ...ONE_PAGE, ...pageInfo },
})

const SELF = {
  ...ADA,
  memberId: 'member-2',
  userId: 'user-2',
  name: 'Grace Hopper',
  team: 'Executive',
  organizationRole: 'owner' as const,
  portalRole: 'admin' as const,
  isSelf: true,
}

const user = () => userEvent.setup()

describe('MembersTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.search = ''
    actions.listMembers.mockResolvedValue(page([ADA, SELF]))
    actions.setOrganizationRole.mockResolvedValue({ ok: true })
    actions.setPortalRole.mockResolvedValue({ ok: true })
    actions.setBanned.mockResolvedValue({ ok: true })
  })

  it('lists each member with their department and both roles', async () => {
    render(<MembersTable />)

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Information Technology')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Portal role for Ada Lovelace' })).toHaveValue(
      'Member',
    )
    expect(
      screen.getByRole('combobox', { name: 'Organization role for Ada Lovelace' }),
    ).toHaveValue('member')
  })

  it('marks your own row and offers no way to suspend yourself', async () => {
    render(<MembersTable />)

    expect(await screen.findByText('You')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Suspend Grace Hopper/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Suspend Ada Lovelace/ })).toBeInTheDocument()
  })

  it('shows the new portal role before the server answers', async () => {
    let resolve: (value: { ok: true }) => void = () => {}
    actions.setPortalRole.mockReturnValue(
      new Promise<{ ok: true }>((r) => {
        resolve = r
      }),
    )
    const person = user()
    render(<MembersTable />)

    await person.click(
      await screen.findByRole('combobox', { name: 'Portal role for Ada Lovelace' }),
    )
    await person.click(screen.getByRole('option', { name: 'Admin' }))

    // Optimistic: the row reads Admin while the action is still pending.
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Portal role for Ada Lovelace' })).toHaveValue(
        'Admin',
      ),
    )
    resolve({ ok: true })
  })

  it('restores the previous role and announces it when the server refuses', async () => {
    actions.setPortalRole.mockResolvedValue({
      ok: false,
      message: 'You cannot remove your own portal admin role.',
    })
    const person = user()
    render(<MembersTable />)

    await person.click(
      await screen.findByRole('combobox', { name: 'Portal role for Ada Lovelace' }),
    )
    await person.click(screen.getByRole('option', { name: 'Admin' }))

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Portal role for Ada Lovelace' })).toHaveValue(
        'Member',
      ),
    )
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'red',
        autoClose: false,
        message: 'You cannot remove your own portal admin role.',
      }),
    )
  })

  it('suspends optimistically and rolls the badge back on failure', async () => {
    actions.setBanned.mockResolvedValue({ ok: false, message: 'Could not change that account.' })
    const person = user()
    render(<MembersTable />)

    await person.click(await screen.findByRole('button', { name: /Suspend Ada Lovelace/ }))

    await waitFor(() => expect(actions.setBanned).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText('Active').length).toBe(2))
    expect(toast.show).toHaveBeenCalled()
  })

  it('offers a retry when the list cannot load', async () => {
    actions.listMembers.mockResolvedValue({ ok: false, message: 'You do not have permission.' })
    render(<MembersTable />)

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('explains an empty organization instead of showing a bare table', async () => {
    actions.listMembers.mockResolvedValue(page([], { total: 0 }))
    render(<MembersTable />)

    expect(await screen.findByText(/Nobody has finished onboarding yet/)).toBeInTheDocument()
  })

  it('asks the server for the page, sort and filters the URL carries', async () => {
    nav.search = 'page=2&search=ada&status=suspended&sortBy=startDate&sortDirection=desc'
    render(<MembersTable />)

    await screen.findByText('Ada Lovelace')
    expect(actions.listMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        search: 'ada',
        status: 'suspended',
        sortBy: 'startDate',
        sortDirection: 'desc',
      }),
    )
  })

  it('puts a header click in the URL instead of sorting the page in place', async () => {
    const person = user()
    render(<MembersTable />)

    await person.click(await screen.findByRole('button', { name: /Sort by Person, descending/ }))

    expect(nav.replace).toHaveBeenCalledWith('/organization/members?sortDirection=desc', {
      scroll: false,
    })
  })

  it('pages through the server pages from the footer', async () => {
    actions.listMembers.mockResolvedValue(
      page([ADA, SELF], { total: 60, pageCount: 3, hasNext: true }),
    )
    const person = user()
    render(<MembersTable />)

    expect(await screen.findByText('Showing 1–25 of 60')).toBeInTheDocument()
    await person.click(screen.getByRole('button', { name: 'Page 2' }))

    expect(nav.replace).toHaveBeenCalledWith('/organization/members?page=2', { scroll: false })
  })

  it('separates a filtered dead end from an empty organization and offers a way back', async () => {
    nav.search = 'search=nobody'
    actions.listMembers.mockResolvedValue(page([], { total: 0 }))
    const person = user()
    render(<MembersTable />)

    expect(await screen.findByText('No member matches these filters.')).toBeInTheDocument()
    await person.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(nav.replace).toHaveBeenCalledWith('/organization/members', { scroll: false })
  })

  it('has no axe violations', async () => {
    const { container } = render(<MembersTable />)
    await screen.findByText('Ada Lovelace')
    expect(await axe(container)).toHaveNoViolations()
  })
})
