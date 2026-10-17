import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { visibleSections } from '@/lib/navigation'
import { routes } from '@/lib/routes'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { searchSpotlight } from '../spotlight-store'
import { readRecent, recentKey } from '../utils/recent-searches'
import { SearchPalette } from './search-palette'

const router = vi.hoisted(() => ({ push: vi.fn() }))
const clients = vi.hoisted(() => ({ search: { getDirectory: vi.fn(), searchTasks: vi.fn() } }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
// Mocked at the generated client, the transport edge, so the hook and its cache run for real.
vi.mock('@/rpc/browser', () => ({ browserClients: clients }))

const KEY = recentKey('org-1', 'user-1')
const SECTIONS = visibleSections({
  canManageOrganization: true,
  canApproveRequests: true,
  canManageHiring: true,
  canViewWebsites: true,
})
const SEARCH = { name: 'Search pages, people, clients and tasks' }
const DIRECTORY = {
  people: [
    {
      userId: 'user-2',
      name: 'Grace Hopper',
      jobTitle: 'Recruiter',
      department: 'HR',
      photoUrl: '',
    },
    { userId: 'user-3', name: 'Zoe Park', jobTitle: '', department: '', photoUrl: '' },
  ],
  clients: [{ clientId: 'client-1', name: 'Acme Health', status: 'on_hold' }],
}
const RENEWAL_TASK = {
  taskId: 'task-1',
  taskNumber: 12,
  name: 'Renewal pack',
  projectId: 'project-1',
  projectName: 'Renewals',
  statusName: 'In review',
  statusColor: '#1346C5',
}

function renderPalette(persistRecent = true) {
  const view = render(
    <SearchPalette sections={SECTIONS} storageKey={KEY} persistRecent={persistRecent} />,
  )
  act(() => searchSpotlight.open())
  return view
}

beforeEach(() => {
  router.push.mockClear()
  clients.search.getDirectory.mockReset()
  clients.search.getDirectory.mockResolvedValue(DIRECTORY)
  clients.search.searchTasks.mockReset()
  clients.search.searchTasks.mockResolvedValue({ tasks: [] })
})

afterEach(() => {
  act(() => searchSpotlight.close())
  window.localStorage.clear()
})

describe('SearchPalette pages', () => {
  it('suggests pages before anything is typed', async () => {
    renderPalette()

    await waitFor(() => expect(screen.getByRole('textbox', SEARCH)).toHaveFocus())
    expect(screen.getByRole('group', { name: 'Pages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dashboard/ })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'People' })).not.toBeInTheDocument()
  })

  it('narrows to the matching pages and announces the count', async () => {
    const user = userEvent.setup()
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'contracts')

    expect(screen.getByRole('button', { name: /^Contracts/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Dashboard/ })).not.toBeInTheDocument()
    // Announced once the task search settles, so a screen reader never hears a count that then changes.
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 result'))
  })

  it('says so when nothing matches, keeping what was typed', async () => {
    const user = userEvent.setup()
    renderPalette()
    const input = screen.getByRole('textbox', SEARCH)

    await user.type(input, 'zzzz')

    expect(await screen.findByText(/Nothing matches “zzzz”/)).toBeInTheDocument()
    expect(input).toHaveValue('zzzz')
  })

  it('opens the chosen page from the keyboard and remembers it', async () => {
    const user = userEvent.setup()
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'contracts')
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

    await waitFor(() => expect(screen.queryByRole('textbox', SEARCH)).not.toBeInTheDocument())
  })

  it('remembers nothing while an admin is impersonating', async () => {
    const user = userEvent.setup()
    renderPalette(false)

    await user.click(screen.getByRole('button', { name: /^Bulletin board/ }))

    expect(router.push).toHaveBeenCalledWith(routes.bulletin)
    expect(readRecent(KEY)).toEqual([])
  })
})

describe('SearchPalette people and clients', () => {
  it('finds people by name, job title or department', async () => {
    const user = userEvent.setup()
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'recruit')

    const people = await screen.findByRole('group', { name: 'People' })
    expect(within(people).getByRole('button', { name: /Grace Hopper/ })).toHaveTextContent('HR')
    expect(within(people).queryByText('Zoe Park')).not.toBeInTheDocument()
    // One clean name for screen readers, whatever the highlight does to the visible text.
    expect(
      within(people).getByRole('button', { name: 'Grace Hopper, Recruiter, HR' }),
    ).toBeVisible()
  })

  it('finds clients and labels their status the way the clients page does', async () => {
    const user = userEvent.setup()
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'acme')

    const group = await screen.findByRole('group', { name: 'Clients' })
    expect(within(group).getByRole('button', { name: /Acme Health/ })).toHaveTextContent('On hold')
  })

  it('asks the server once, however much is typed', async () => {
    const user = userEvent.setup()
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'grace hopper')
    await screen.findByRole('group', { name: 'People' })
    await user.clear(screen.getByRole('textbox', SEARCH))
    await user.type(screen.getByRole('textbox', SEARCH), 'acme')
    await screen.findByRole('group', { name: 'Clients' })

    expect(clients.search.getDirectory).toHaveBeenCalledTimes(1)
  })

  it('opens a person on the directory, filtered to their name', async () => {
    const user = userEvent.setup()
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'grace')
    await user.click(await screen.findByRole('button', { name: /Grace Hopper/ }))

    expect(router.push).toHaveBeenCalledWith(`${routes.directory}?search=Grace%20Hopper`)
  })

  it('holds the place with a skeleton while the directory loads, pages still searchable', async () => {
    const user = userEvent.setup()
    clients.search.getDirectory.mockReturnValue(new Promise(() => {}))
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'contracts')

    expect(screen.getByLabelText('Loading people and clients')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: /^Contracts/ })).toBeInTheDocument()
    expect(screen.queryByText(/Nothing matches/)).not.toBeInTheDocument()
  })

  it('says when the directory fails, keeps pages working, and retries on request', async () => {
    const user = userEvent.setup()
    clients.search.getDirectory.mockRejectedValueOnce(new Error('offline'))
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'grace')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t load people and clients — check your connection and try again.',
    )
    await user.click(screen.getByRole('button', { name: 'Try again to load people and clients' }))

    expect(await screen.findByRole('button', { name: /Grace Hopper/ })).toBeInTheDocument()
    expect(clients.search.getDirectory).toHaveBeenCalledTimes(2)
  })

  it('has no axe violations with every group showing', async () => {
    const user = userEvent.setup()
    const { baseElement } = renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'a')
    await screen.findByRole('group', { name: 'People' })

    expect(await axe(baseElement)).toHaveNoViolations()
  })
})

describe('SearchPalette tasks', () => {
  it('finds a task and opens it on the board', async () => {
    const user = userEvent.setup()
    clients.search.searchTasks.mockResolvedValue({ tasks: [RENEWAL_TASK] })
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'renewal')
    const result = await screen.findByRole('button', {
      name: 'Renewal pack, #12 · Renewals, In review',
    })
    await user.click(result)

    expect(router.push).toHaveBeenCalledWith(`${routes.tasks}?project=project-1&task=task-1`)
  })

  it('asks the server once for a word typed in one go, not once per letter', async () => {
    const user = userEvent.setup()
    clients.search.searchTasks.mockResolvedValue({ tasks: [RENEWAL_TASK] })
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'renewals')
    await screen.findByRole('group', { name: 'Tasks' })

    expect(clients.search.searchTasks).toHaveBeenCalledTimes(1)
    expect(clients.search.searchTasks.mock.calls[0]?.[0]).toEqual({ query: 'renewals' })
  })

  it('answers a longer query from a complete shorter one without asking again', async () => {
    const user = userEvent.setup()
    clients.search.searchTasks.mockResolvedValue({
      tasks: [
        RENEWAL_TASK,
        { ...RENEWAL_TASK, taskId: 'task-2', taskNumber: 3, name: 'Rent hall' },
      ],
    })
    renderPalette()
    const input = screen.getByRole('textbox', SEARCH)

    await user.type(input, 'ren')
    await screen.findByRole('button', { name: /^Rent hall/ })
    await user.type(input, 'ew')

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Rent hall/ })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /^Renewal pack/ })).toBeInTheDocument()
    expect(clients.search.searchTasks).toHaveBeenCalledTimes(1)
  })

  it('does not ask about tasks for a single character', async () => {
    const user = userEvent.setup()
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'r')
    await screen.findByRole('status')
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(clients.search.searchTasks).not.toHaveBeenCalled()
  })

  it('shows one placeholder row while tasks load, the other groups already there', async () => {
    const user = userEvent.setup()
    clients.search.searchTasks.mockReturnValue(new Promise(() => {}))
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'contracts')

    expect(await screen.findByLabelText('Loading tasks')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: /^Contracts/ })).toBeInTheDocument()
  })

  it('says when tasks fail and retries on request', async () => {
    const user = userEvent.setup()
    clients.search.searchTasks
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ tasks: [RENEWAL_TASK] })
    renderPalette()

    await user.type(screen.getByRole('textbox', SEARCH), 'renewal')
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load tasks')
    await user.click(screen.getByRole('button', { name: 'Try again to load tasks' }))

    expect(await screen.findByRole('button', { name: /^Renewal pack/ })).toBeInTheDocument()
  })
})
