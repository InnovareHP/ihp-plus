import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { render, screen, userEvent, waitFor, within } from '@/test/render'

const actions = vi.hoisted(() => ({
  listLibraryFolder: vi.fn(),
  uploadToLibraryFolder: vi.fn(),
  startLibraryUpload: vi.fn(),
  sendLibraryUploadChunk: vi.fn(),
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

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }))

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
  useSearchParams: () => nav.params,
  useRouter: () => ({ replace: nav.replace }),
}))
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('@/lib/announce', () => announce)

const { LibraryBrowser } = await import('./library-browser')
const { LIBRARY_CHUNK_BYTES } = await import('../schema')

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

const IMAGE = {
  ...FILE,
  id: 'img-1',
  name: 'team.jpg',
  path: 'team.jpg',
  contentType: 'image/jpeg',
}

function picked(name: string, relativePath: string) {
  const file = new File(['x'], name, { type: 'image/png' })
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
  return file
}

beforeEach(() => {
  vi.clearAllMocks()
  nav.params = new URLSearchParams()
  urlQuery.query = { path: '', sortBy: 'name', sortDirection: 'asc' }
  actions.listLibraryFolder.mockResolvedValue({ ok: true, path: '', entries: [FOLDER, FILE] })
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

  it('downloads a file through our own origin, never a SharePoint link', async () => {
    render(<LibraryBrowser />)

    await userEvent.click(await screen.findByRole('button', { name: `Actions for ${FILE.name}` }))
    const download = await screen.findByRole('menuitem', { name: 'Download' })

    expect(download).toHaveAttribute(
      'href',
      `/app/api/library/files/file-1?download=1&v=${encodeURIComponent(FILE.lastModifiedAt)}`,
    )
  })

  it('opens an image in the preview from its name, through the URL', async () => {
    actions.listLibraryFolder.mockResolvedValue({ ok: true, path: '', entries: [IMAGE, FILE] })
    render(<LibraryBrowser />)

    await userEvent.click(await screen.findByRole('button', { name: IMAGE.name }))

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('/library?preview=img-1', { scroll: false }),
    )
    expect(screen.queryByRole('button', { name: FILE.name })).not.toBeInTheDocument()
  })

  it('steps through the folder images in the preview, by button and arrow key', async () => {
    nav.params = new URLSearchParams('preview=img-1')
    actions.listLibraryFolder.mockResolvedValue({
      ok: true,
      path: '',
      entries: [IMAGE, { ...IMAGE, id: 'img-2', name: 'office.png' }, FILE],
    })
    const { container } = render(<LibraryBrowser />)

    const dialog = await screen.findByRole('dialog', { name: IMAGE.name })
    expect(await axe(container)).toHaveNoViolations()
    expect(within(dialog).getByRole('img', { name: IMAGE.name })).toHaveAttribute(
      'src',
      expect.stringContaining('/app/api/library/files/img-1?rendition=preview'),
    )
    expect(within(dialog).getByText('1 of 2')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Previous image' })).toBeDisabled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Next image' }))
    await waitFor(() =>
      expect(nav.replace).toHaveBeenLastCalledWith('/library?preview=img-2', { scroll: false }),
    )

    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(nav.replace).toHaveBeenCalledTimes(2))
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

  it('uploads a picked folder with its tree, showing it as one new folder row', async () => {
    actions.uploadToLibraryFolder.mockReturnValue(new Promise(() => {}))
    render(<LibraryBrowser />)
    await screen.findByText('handbook.pdf')

    await userEvent.upload(screen.getByLabelText('Upload a folder'), [
      picked('a.png', 'Photos/a.png'),
      picked('b.png', 'Photos/2026/b.png'),
    ])

    expect(await screen.findByRole('link', { name: 'Photos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /uploading… 2 left/i })).toBeInTheDocument()
    await waitFor(() => expect(actions.uploadToLibraryFolder).toHaveBeenCalled())
    const first = actions.uploadToLibraryFolder.mock.calls[0]?.[0] as FormData
    expect(first.get('folder')).toBe('Photos')
    expect((first.get('file') as File).name).toBe('a.png')
  })

  it('uploads files dropped onto the table', async () => {
    render(<LibraryBrowser />)
    const table = await screen.findByRole('table')
    const file = new File(['x'], 'dropped.pdf', { type: 'application/pdf' })
    const dataTransfer = { types: ['Files'], items: [], files: [file], dropEffect: 'none' }

    fireEvent.dragOver(table, { dataTransfer })
    expect(await screen.findByText(/drop to upload to internal library/i)).toBeInTheDocument()
    fireEvent.drop(table, { dataTransfer })

    await waitFor(() => expect(actions.uploadToLibraryFolder).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/drop to upload/i)).not.toBeInTheDocument()
  })

  it('sends uploads one at a time, so a big drop never becomes one huge request', async () => {
    actions.uploadToLibraryFolder.mockReturnValue(new Promise(() => {}))
    render(<LibraryBrowser />)
    await screen.findByText('handbook.pdf')

    await userEvent.upload(screen.getByLabelText('Upload files'), [
      new File(['a'], 'a.pdf', { type: 'application/pdf' }),
      new File(['b'], 'b.pdf', { type: 'application/pdf' }),
    ])

    expect(await screen.findByText('b.pdf')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /uploading… 2 left/i })).toBeInTheDocument()
    await waitFor(() => expect(actions.uploadToLibraryFolder).toHaveBeenCalledTimes(1))
  })

  it('refuses an oversized file in the browser, before sending anything', async () => {
    render(<LibraryBrowser />)
    await screen.findByText('handbook.pdf')
    const file = new File(['x'], 'video.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 251 * 1024 * 1024 })

    await userEvent.upload(screen.getByLabelText('Upload files'), file)

    await waitFor(() =>
      expect(announce.announceFailure).toHaveBeenCalledWith(
        'video.mp4: Files have to be 250 MB or smaller.',
      ),
    )
    expect(actions.uploadToLibraryFolder).not.toHaveBeenCalled()
    expect(actions.startLibraryUpload).not.toHaveBeenCalled()
  })

  it('sends a large file in chunks under the request size limit', async () => {
    actions.startLibraryUpload.mockResolvedValue({ ok: true, data: { token: 'sealed' } })
    actions.sendLibraryUploadChunk
      .mockResolvedValueOnce({ ok: true, data: { entry: null } })
      .mockResolvedValueOnce({ ok: true, data: { entry: { ...FILE, id: 'big', name: 'big.zip' } } })
    render(<LibraryBrowser />)
    await screen.findByText('handbook.pdf')
    const size = LIBRARY_CHUNK_BYTES + 10
    const file = new File([new Uint8Array(size)], 'big.zip', { type: 'application/zip' })

    await userEvent.upload(screen.getByLabelText('Upload files'), file)

    await waitFor(() => expect(actions.sendLibraryUploadChunk).toHaveBeenCalledTimes(2))
    expect(actions.startLibraryUpload).toHaveBeenCalledWith({
      path: '',
      folder: '',
      name: 'big.zip',
      size,
    })
    const last = actions.sendLibraryUploadChunk.mock.calls[1]?.[0] as FormData
    expect(last.get('start')).toBe(String(LIBRARY_CHUNK_BYTES))
    expect((last.get('chunk') as Blob).size).toBe(10)
    expect(actions.uploadToLibraryFolder).not.toHaveBeenCalled()
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
      expect(announce.announceFailure).toHaveBeenCalledWith(
        'huge.pdf: Files have to be 25 MB or smaller.',
      ),
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
