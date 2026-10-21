import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { visibleSections } from '@/lib/navigation'
import { render, screen, userEvent } from '@/test/render'
import { searchSpotlight } from '../spotlight-store'
import { recentKey } from '../utils/recent-searches'
import { SearchLauncher } from './search-launcher'

const clients = vi.hoisted(() => ({
  search: {
    getDirectory: vi.fn(() => new Promise(() => {})),
    searchTasks: vi.fn(() => new Promise(() => {})),
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/rpc/browser', () => ({ browserClients: clients }))

const SECTIONS = visibleSections({
  canManageOrganization: true,
  canApproveRequests: false,
  canManageHiring: false,
  canViewWebsites: false,
})

function renderLauncher() {
  return render(
    <>
      <label htmlFor="note">Note</label>
      <input id="note" />
      <SearchLauncher sections={SECTIONS} storageKey={recentKey('org-1', 'user-1')} persistRecent />
    </>,
  )
}

afterEach(() => {
  act(() => searchSpotlight.close())
})

describe('SearchLauncher', () => {
  it('loads nothing until search is asked for', () => {
    renderLauncher()

    expect(
      screen.queryByRole('textbox', { name: 'Search pages, people, clients and tasks' }),
    ).not.toBeInTheDocument()
  })

  it('opens the palette from the header button', async () => {
    const user = userEvent.setup()
    renderLauncher()

    await user.click(screen.getAllByRole('button', { name: 'Search' })[0] as HTMLElement)

    expect(
      await screen.findByRole(
        'textbox',
        { name: 'Search pages, people, clients and tasks' },
        // The palette's code is fetched on first open, which a full parallel run can slow past 1 s.
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
  })

  it('opens the palette with Ctrl+K', async () => {
    const user = userEvent.setup()
    renderLauncher()

    await user.keyboard('{Control>}k{/Control}')

    expect(
      await screen.findByRole(
        'textbox',
        { name: 'Search pages, people, clients and tasks' },
        // The palette's code is fetched on first open, which a full parallel run can slow past 1 s.
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
  })

  it('leaves Ctrl+K alone while the person is typing in a field', async () => {
    const user = userEvent.setup()
    renderLauncher()

    await user.click(screen.getByLabelText('Note'))
    await user.keyboard('{Control>}k{/Control}')

    expect(
      screen.queryByRole('textbox', { name: 'Search pages, people, clients and tasks' }),
    ).not.toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = renderLauncher()

    expect(await axe(container)).toHaveNoViolations()
  })
})
