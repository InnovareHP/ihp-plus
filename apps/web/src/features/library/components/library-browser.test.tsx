import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/render'

const actions = vi.hoisted(() => ({
  listLibraryFolder: vi.fn(),
  libraryFileLink: vi.fn(),
}))

const urlQuery = vi.hoisted(() => ({
  // Spelled out rather than imported: vi.hoisted runs before the module graph is ready.
  query: { path: '', sortBy: 'name', sortDirection: 'asc' } as {
    path: string
    sortBy: 'name' | 'lastModifiedAt' | 'size'
    sortDirection: 'asc' | 'desc'
  },
  setQuery: vi.fn(),
  clearFilters: vi.fn(),
}))

const announce = vi.hoisted(() => ({ announceFailure: vi.fn(), announceSuccess: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('../hooks/use-library-query', async () => {
  const actual = await vi.importActual<typeof import('../hooks/use-library-query')>(
    '../hooks/use-library-query',
  )
  return { ...actual, useLibraryQuery: () => urlQuery }
})
vi.mock('next/navigation', () => ({ usePathname: () => '/library' }))
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('@/lib/announce', () => announce)

const { LibraryBrowser } = await import('./library-browser')

const FOLDER = {
  id: 'folder-1',
  name: 'Clients',
  isFolder: true,
  path: 'Clients',
  size: undefined,
  contentType: undefined,
  lastModifiedAt: '2026-03-01T10:00:00.000Z',
  childCount: 3,
}

const FILE = {
  id: 'file-1',
  name: 'handbook.pdf',
  isFolder: false,
  path: 'handbook.pdf',
  size: 2048,
  contentType: 'application/pdf',
  lastModifiedAt: '2026-03-04T10:00:00.000Z',
  childCount: undefined,
}

beforeEach(() => {
  vi.clearAllMocks()
  urlQuery.query = { path: '', sortBy: 'name', sortDirection: 'asc' }
  actions.listLibraryFolder.mockResolvedValue({ ok: true, path: '', entries: [FOLDER, FILE] })
  actions.libraryFileLink.mockResolvedValue({ ok: true, data: { url: 'https://graph.test/d' } })
})

describe('LibraryBrowser', () => {
  it('lists what is in the folder, with a folder linking one level down', async () => {
    render(<LibraryBrowser />)

    expect(await screen.findByRole('link', { name: 'Clients' })).toHaveAttribute(
      'href',
      '/library?path=Clients',
    )
    expect(screen.getByText('handbook.pdf')).toBeInTheDocument()
    expect(screen.getByText('3 items')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
  })

  it('opens a file in a new tab with a freshly minted link', async () => {
    const opener = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<LibraryBrowser />)

    await userEvent.click(await screen.findByRole('button', { name: 'Open' }))

    await waitFor(() => expect(actions.libraryFileLink).toHaveBeenCalledWith({ itemId: 'file-1' }))
    expect(opener).toHaveBeenCalledWith('https://graph.test/d', '_blank', 'noopener,noreferrer')
  })

  it('announces a failure to open instead of leaving the click unexplained', async () => {
    actions.libraryFileLink.mockResolvedValue({ ok: false, message: 'That file is gone.' })
    render(<LibraryBrowser />)

    await userEvent.click(await screen.findByRole('button', { name: 'Open' }))

    await waitFor(() => expect(announce.announceFailure).toHaveBeenCalledWith('That file is gone.'))
  })

  it('offers a way out of an empty subfolder', async () => {
    urlQuery.query = { path: 'Clients/Acme', sortBy: 'name', sortDirection: 'asc' }
    actions.listLibraryFolder.mockResolvedValue({ ok: true, path: 'Clients/Acme', entries: [] })
    render(<LibraryBrowser />)

    await userEvent.click(await screen.findByRole('button', { name: 'Go up one folder' }))

    expect(urlQuery.setQuery).toHaveBeenCalledWith({ path: 'Clients' })
  })

  it('shows the reason a folder could not be read, with a retry', async () => {
    actions.listLibraryFolder.mockResolvedValue({ ok: false, message: 'That folder is gone.' })
    render(<LibraryBrowser />)

    expect(await screen.findByText('That folder is gone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<LibraryBrowser />)
    await screen.findByRole('link', { name: 'Clients' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
