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
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn(), refresh: vi.fn() }))
const admin = vi.hoisted(() => ({ impersonateUser: vi.fn() }))

vi.mock('../rpc', () => actions)
vi.mock('@/lib/auth-client', () => ({ authClient: { admin } }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, refresh: nav.refresh }),
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
    actions.setOrganizationRole.mockResolvedValue(ADA)
    actions.setPortalRole.mockResolvedValue(ADA)
    actions.setBanned.mockResolvedValue(ADA)
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
    let resolve: (value: unknown) => void = () => {}
    actions.setPortalRole.mockReturnValue(
      new Promise<unknown>((r) => {
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
    resolve(ADA)
  })

  it('restores the previous role and announces it when the server refuses', async () => {
    actions.setPortalRole.mockRejectedValue(
      new Error('You cannot remove your own portal admin role.'),
    )
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
    actions.setBanned.mockRejectedValue(new Error('Could not change that account.'))
    const person = user()
    render(<MembersTable />)

    await person.click(await screen.findByRole('button', { name: /Suspend Ada Lovelace/ }))

    await waitFor(() => expect(actions.setBanned).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText('Active').length).toBe(2))
    expect(toast.show).toHaveBeenCalled()
  })

  it('offers sign in as only to a portal admin, and never for themselves or another admin', async () => {
    const { unmount } = render(<MembersTable />)
    await screen.findByText('Ada Lovelace')
    expect(screen.queryByRole('button', { name: /Sign in as/ })).not.toBeInTheDocument()
    unmount()

    render(<MembersTable canImpersonate />)
    expect(await screen.findByRole('button', { name: 'Sign in as Ada Lovelace' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Sign in as Grace Hopper' }),
    ).not.toBeInTheDocument()
  })

  it('does not offer sign in as for a suspended member', async () => {
    actions.listMembers.mockResolvedValue(page([{ ...ADA, banned: true }, SELF]))
    render(<MembersTable canImpersonate />)

    await screen.findByText('Ada Lovelace')
    expect(screen.queryByRole('button', { name: /Sign in as/ })).not.toBeInTheDocument()
  })

  it('signs in as the member and lands on their dashboard', async () => {
    admin.impersonateUser.mockResolvedValue({ data: {}, error: null })
    const person = user()
    render(<MembersTable canImpersonate />)

    await person.click(await screen.findByRole('button', { name: 'Sign in as Ada Lovelace' }))

    expect(admin.impersonateUser).toHaveBeenCalledWith({ userId: 'user-1' })
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/'))
    expect(nav.refresh).toHaveBeenCalled()
  })

  it('announces a refused sign in as and stays on the list', async () => {
    admin.impersonateUser.mockResolvedValue({
      data: null,
      error: { code: 'YOU_CANNOT_IMPERSONATE_ADMINS', message: 'You cannot impersonate admins' },
    })
    const person = user()
    render(<MembersTable canImpersonate />)

    await person.click(await screen.findByRole('button', { name: 'Sign in as Ada Lovelace' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'red',
          autoClose: false,
          message: 'You cannot sign in as another portal admin.',
        }),
      ),
    )
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('offers a retry when the list cannot load', async () => {
    actions.listMembers.mockRejectedValue(new Error('You do not have permission.'))
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
