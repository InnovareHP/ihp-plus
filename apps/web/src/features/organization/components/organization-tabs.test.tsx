import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { OrganizationTabs } from './organization-tabs'

const nav = vi.hoisted(() => ({ replace: vi.fn(), searchParams: new URLSearchParams() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => nav.searchParams,
  usePathname: () => '/organization',
}))

// Each panel owns its own data; this is about which one is mounted, not what it renders.
vi.mock('./organization-panel', () => ({ OrganizationPanel: () => <p>overview panel</p> }))
vi.mock('./teams-panel', () => ({ TeamsPanel: () => <p>departments panel</p> }))
vi.mock('./invitations-panel', () => ({ InvitationsPanel: () => <p>invitations panel</p> }))
vi.mock('@/features/members/components/members-table', () => ({
  MembersTable: () => <p>members panel</p>,
}))

const user = () => userEvent.setup()

describe('OrganizationTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.searchParams = new URLSearchParams()
  })

  it('gathers the whole organization into one page of tabs', () => {
    render(<OrganizationTabs invitedBy="Grace Hopper" />)

    for (const label of ['Overview', 'Members', 'Departments', 'Invitations']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
    // Approvers are set inside each department now, not on a tab of their own.
    expect(screen.queryByRole('tab', { name: 'Approvers' })).not.toBeInTheDocument()
  })

  it('opens on the overview when the URL names no tab', () => {
    render(<OrganizationTabs invitedBy="Grace Hopper" />)

    expect(screen.getByText('overview panel')).toBeInTheDocument()
    expect(screen.queryByText('members panel')).not.toBeInTheDocument()
  })

  it('renders the tab the URL asks for, so each one is a deep link', () => {
    nav.searchParams = new URLSearchParams('tab=members')
    render(<OrganizationTabs invitedBy="Grace Hopper" />)

    expect(screen.getByText('members panel')).toBeInTheDocument()
  })

  it('sends an old link to the approvers tab to the departments, where approvers are set', () => {
    nav.searchParams = new URLSearchParams('tab=approvers')
    render(<OrganizationTabs invitedBy="Grace Hopper" />)

    expect(screen.getByText('departments panel')).toBeInTheDocument()
  })

  it('falls back to the overview for a tab that does not exist', () => {
    nav.searchParams = new URLSearchParams('tab=nonsense')
    render(<OrganizationTabs invitedBy="Grace Hopper" />)

    expect(screen.getByText('overview panel')).toBeInTheDocument()
  })

  it('puts the open tab in the URL', async () => {
    const person = user()
    render(<OrganizationTabs invitedBy="Grace Hopper" />)

    await person.click(screen.getByRole('tab', { name: 'Departments' }))

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('/organization?tab=departments', { scroll: false }),
    )
  })

  it('leaves the overview out of the URL, since it is the default', async () => {
    nav.searchParams = new URLSearchParams('tab=members')
    const person = user()
    render(<OrganizationTabs invitedBy="Grace Hopper" />)

    await person.click(screen.getByRole('tab', { name: 'Overview' }))

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('/organization', { scroll: false }),
    )
  })

  it('does not mount a tab nobody has opened, so it runs no queries', () => {
    render(<OrganizationTabs invitedBy="Grace Hopper" />)

    expect(screen.queryByText('departments panel')).not.toBeInTheDocument()
    expect(screen.queryByText('invitations panel')).not.toBeInTheDocument()
  })
})
