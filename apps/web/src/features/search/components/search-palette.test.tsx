import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { visibleSections } from '@/lib/navigation'
import { routes } from '@/lib/routes'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { searchSpotlight } from '../spotlight-store'
import { readRecent, recentKey } from '../utils/recent-searches'
import { SearchPalette } from './search-palette'

const router = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const KEY = recentKey('org-1', 'user-1')
const SECTIONS = visibleSections({
  canManageOrganization: true,
  canApproveRequests: true,
  canManageHiring: true,
  canViewWebsites: true,
})

function renderPalette(persistRecent = true) {
  const view = render(
    <SearchPalette sections={SECTIONS} storageKey={KEY} persistRecent={persistRecent} />,
  )
  act(() => searchSpotlight.open())
  return view
}

beforeEach(() => {
  router.push.mockClear()
})

afterEach(() => {
  act(() => searchSpotlight.close())
  window.localStorage.clear()
})

describe('SearchPalette', () => {
  it('suggests pages before anything is typed', async () => {
    renderPalette()

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Search pages' })).toHaveFocus())
    expect(screen.getByRole('group', { name: 'Pages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dashboard/ })).toBeInTheDocument()
  })

  it('narrows to the matching pages and announces the count', async () => {
    const user = userEvent.setup()
    renderPalette()

    await user.type(screen.getByRole('textbox', { name: 'Search pages' }), 'contracts')

    expect(screen.getByRole('button', { name: /^Contracts/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Dashboard/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 result')
  })

  it('says so when nothing matches, keeping what was typed', async () => {
    const user = userEvent.setup()
    renderPalette()
    const input = screen.getByRole('textbox', { name: 'Search pages' })

    await user.type(input, 'zzzz')

    expect(screen.getByText(/No pages match “zzzz”/)).toBeInTheDocument()
    expect(input).toHaveValue('zzzz')
  })

  it('opens the chosen page from the keyboard and remembers it', async () => {
    const user = userEvent.setup()
    renderPalette()

    await user.type(screen.getByRole('textbox', { name: 'Search pages' }), 'contracts')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(router.push).toHaveBeenCalledWith(`${routes.clients}?tab=contracts`)
    expect(readRecent(KEY).map((entry) => entry.label)).toEqual(['Contracts'])
  })

  it('shows remembered pages under Recent', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.click(screen.getByRole('button', { name: /^Bulletin board/ }))

    act(() => searchSpotlight.open())

    expect(await screen.findByRole('group', { name: 'Recent' })).toHaveTextContent('Bulletin board')
    expect(screen.getByRole('group', { name: 'Pages' })).not.toHaveTextContent('Bulletin board')
  })

  it('closes from the close button, for touch screens with no Escape key', async () => {
    const user = userEvent.setup()
    renderPalette()

    await user.click(screen.getByRole('button', { name: 'Close search' }))

    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Search pages' })).not.toBeInTheDocument(),
    )
  })

  it('remembers nothing while an admin is impersonating', async () => {
    const user = userEvent.setup()
    renderPalette(false)

    await user.click(screen.getByRole('button', { name: /^Bulletin board/ }))

    expect(router.push).toHaveBeenCalledWith(routes.bulletin)
    expect(readRecent(KEY)).toEqual([])
  })

  it('has no axe violations', async () => {
    const { baseElement } = renderPalette()

    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
