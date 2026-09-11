import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { OrganizationPanel } from './organization-panel'

const actions = vi.hoisted(() => ({
  getOrganizationSummary: vi.fn(),
  updateOrganizationProfile: vi.fn(),
}))

const nav = vi.hoisted(() => ({ refresh: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../actions', () => actions)
// The panel nests the contract terms editor, which talks over RPC; this screen is not where
// that is under test, so it is stubbed rather than left to reach a transport.
vi.mock('@/features/contracts/rpc', () => ({
  getContractTemplate: vi.fn(async () => ({ scopeTemplate: '', standardTerms: '' })),
  updateContractTemplate: vi.fn(async () => ({ scopeTemplate: '', standardTerms: '' })),
}))
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: nav.refresh, replace: vi.fn(), push: vi.fn() }),
}))

const SUMMARY = {
  id: 'org-1',
  name: 'Innovare Health Partners',
  slug: 'ihp',
  logo: '',
  memberCount: 42,
  teamCount: 10,
  pendingInvitationCount: 3,
  unassignedCount: 1,
}

const user = () => userEvent.setup()

describe('OrganizationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.getOrganizationSummary.mockResolvedValue({ ok: true, data: SUMMARY })
    actions.updateOrganizationProfile.mockResolvedValue({ ok: true })
  })

  it('counts the people, departments and invitations in the organization', async () => {
    render(<OrganizationPanel />)

    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('saves the profile and refreshes the shell that shows the name', async () => {
    const person = user()
    render(<OrganizationPanel />)

    const name = await screen.findByLabelText(/Organization name/)
    await person.clear(name)
    await person.type(name, 'Innovare Health')
    await person.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(actions.updateOrganizationProfile).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Innovare Health', slug: 'ihp' }),
      ),
    )
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled())
  })

  it('rejects a slug with spaces before the server sees it', async () => {
    const person = user()
    render(<OrganizationPanel />)

    const slug = await screen.findByLabelText(/Slug/)
    await person.clear(slug)
    await person.type(slug, 'not a slug')
    await person.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('Use lowercase letters, numbers and single hyphens.'),
    ).toBeInTheDocument()
    expect(actions.updateOrganizationProfile).not.toHaveBeenCalled()
  })

  it('puts a server refusal in the form and rolls the optimistic name back', async () => {
    actions.updateOrganizationProfile.mockResolvedValue({
      ok: false,
      message: 'That slug is already in use — pick another.',
    })
    const person = user()
    render(<OrganizationPanel />)

    const slug = await screen.findByLabelText(/Slug/)
    await person.clear(slug)
    await person.type(slug, 'taken')
    await person.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That slug is already in use — pick another.',
    )
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red', autoClose: false }),
    )
    expect(nav.refresh).not.toHaveBeenCalled()
  })

  it('offers a retry when the organization cannot load', async () => {
    actions.getOrganizationSummary.mockResolvedValue({
      ok: false,
      message: 'You do not have permission to manage this organization.',
    })
    render(<OrganizationPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<OrganizationPanel />)
    await screen.findByText('42')
    expect(await axe(container)).toHaveNoViolations()
  })
})
