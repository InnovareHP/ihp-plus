import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent, waitFor, within } from '@/test/render'

const actions = vi.hoisted(() => ({
  listLibraryFolder: vi.fn(),
  libraryFileLink: vi.fn(),
  uploadToLibraryFolder: vi.fn(),
  addLibraryFolder: vi.fn(),
  renameInLibrary: vi.fn(),
  removeFromLibraryFolder: vi.fn(),
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
// The rows-per-page control reads the URL, so the router hooks it uses are stubbed too.
vi.mock('next/navigation', () => ({
  usePathname: () => '/library',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}))
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
  actions.uploadToLibraryFolder.mockResolvedValue({ ok: true, data: { ...FILE, id: 'file-2' } })
  actions.addLibraryFolder.mockResolvedValue({ ok: true, data: { ...FOLDER, id: 'folder-2' } })
  actions.renameInLibrary.mockResolvedValue({ ok: true, data: { ...FILE, name: 'guide.pdf' } })
  actions.removeFromLibraryFolder.mockResolvedValue({ ok: true, data: { id: 'file-1' } })
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

    await userEvent.click(await screen.findByRole('button', { name: 'Download' }))

    await waitFor(() => expect(actions.libraryFileLink).toHaveBeenCalledWith({ itemId: 'file-1' }))
    expect(opener).toHaveBeenCalledWith('https://graph.test/d', '_blank', 'noopener,noreferrer')
  })

  it('announces a failure to open instead of leaving the click unexplained', async () => {
    actions.libraryFileLink.mockResolvedValue({ ok: false, message: 'That file is gone.' })
    render(<LibraryBrowser />)

    await userEvent.click(await screen.findByRole('button', { name: 'Download' }))

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

  it('shows an uploaded file before the server answers', async () => {
    let settle: (value: unknown) => void = () => {}
    actions.uploadToLibraryFolder.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }),
    )
    render(<LibraryBrowser />)
    await screen.findByText('handbook.pdf')

    const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('Upload files'), file)

    expect(await screen.findByText('invoice.pdf')).toBeInTheDocument()
    settle({ ok: true, data: { ...FILE, id: 'file-2', name: 'invoice.pdf' } })
  })

  it('puts the folder back and says why when an upload fails', async () => {
    actions.uploadToLibraryFolder.mockResolvedValue({
      ok: false,
      message: 'Files have to be 25 MB or smaller.',
    })
    render(<LibraryBrowser />)
    await screen.findByText('handbook.pdf')

    const file = new File(['x'], 'huge.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('Upload files'), file)

    await waitFor(() =>
      expect(announce.announceFailure).toHaveBeenCalledWith('Files have to be 25 MB or smaller.'),
    )
    expect(screen.queryByText('huge.pdf')).not.toBeInTheDocument()
  })

  it('creates a folder from the toolbar', async () => {
    render(<LibraryBrowser />)
    await screen.findByText('handbook.pdf')

    await userEvent.click(screen.getByRole('button', { name: 'New folder' }))
    await userEvent.type(await screen.findByLabelText(/folder name/i), 'Invoices')
    await userEvent.click(screen.getByRole('button', { name: 'Create folder' }))

    await waitFor(() =>
      expect(actions.addLibraryFolder).toHaveBeenCalledWith({ path: '', name: 'Invoices' }),
    )
  })

  it('renames an item from its row menu', async () => {
    render(<LibraryBrowser />)
    await screen.findByText('handbook.pdf')

    await userEvent.click(screen.getByRole('button', { name: 'Actions for handbook.pdf' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const field = await screen.findByLabelText(/file name/i)
    await userEvent.clear(field)
    await userEvent.type(field, 'guide.pdf')
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }))

    await waitFor(() =>
      expect(actions.renameInLibrary).toHaveBeenCalledWith({ itemId: 'file-1', name: 'guide.pdf' }),
    )
  })

  it('names the item in the delete confirmation and removes the row', async () => {
    render(<LibraryBrowser />)
    actions.listLibraryFolder.mockResolvedValue({ ok: true, path: '', entries: [FOLDER] })
    await screen.findByText('handbook.pdf')

    await userEvent.click(screen.getByRole('button', { name: 'Actions for handbook.pdf' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('handbook.pdf')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete file' }))

    await waitFor(() =>
      expect(actions.removeFromLibraryFolder).toHaveBeenCalledWith({ itemId: 'file-1' }),
    )
    await waitFor(() => expect(screen.queryByText('handbook.pdf')).not.toBeInTheDocument())
  })

  it('restores a deleted row when the server refuses', async () => {
    actions.removeFromLibraryFolder.mockResolvedValue({ ok: false, message: 'That file is gone.' })
    render(<LibraryBrowser />)
    await screen.findByText('handbook.pdf')

    await userEvent.click(screen.getByRole('button', { name: 'Actions for handbook.pdf' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete file' }))

    await waitFor(() => expect(announce.announceFailure).toHaveBeenCalledWith('That file is gone.'))
    expect(await screen.findByText('handbook.pdf')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<LibraryBrowser />)
    await screen.findByRole('link', { name: 'Clients' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
