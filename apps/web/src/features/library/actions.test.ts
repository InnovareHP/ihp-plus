import { beforeEach, describe, expect, it, vi } from 'vitest'

interface TestItem {
  id: string
  name: string
  folder?: { childCount?: number }
  file?: { mimeType?: string }
}

const graph = vi.hoisted(() => ({
  requireInternalDriveId: vi.fn(() => 'internal-drive'),
  rootItem: vi.fn(async (): Promise<TestItem> => ({
    id: 'root-item',
    name: 'root',
    folder: { childCount: 2 },
  })),
  getItemByPath: vi.fn(async (): Promise<TestItem> => ({
    id: 'clients-item',
    name: 'Clients',
    folder: {},
  })),
  listAllChildren: vi.fn(async () => [] as unknown[]),
  downloadUrl: vi.fn(async () => 'https://graph.test/download'),
  uploadFile: vi.fn(async (): Promise<TestItem> => ({ id: 'new-file', name: 'invoice.pdf' })),
  ensureFolder: vi.fn(async (): Promise<TestItem> => ({
    id: 'new-folder',
    name: 'Invoices',
    folder: {},
  })),
  renameItem: vi.fn(async (): Promise<TestItem> => ({ id: 'file-1', name: 'guide.pdf' })),
  getItem: vi.fn(async (): Promise<TestItem> => ({ id: 'file-1', name: 'handbook.pdf' })),
  deleteItem: vi.fn(async () => undefined),
}))

const sync = vi.hoisted(() => ({
  mirrorWrite: vi.fn(async () => undefined),
  mirrorRename: vi.fn(async () => undefined),
  mirrorRemoval: vi.fn(async () => undefined),
}))

const guard = vi.hoisted(() => ({
  requireOnboarded: vi.fn(async () => ({ user: { id: 'user-1' }, profile: {} })),
  membershipOf: vi.fn((): { organizationId: string | undefined } => ({ organizationId: 'org-1' })),
}))

class TestGraphError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
  get isNotFound() {
    return this.status === 404
  }
  get isConflict() {
    return this.status === 409
  }
}

vi.mock('@ihp/graph', () => ({
  ...graph,
  GraphError: TestGraphError,
  GraphNotConfiguredError: class GraphNotConfiguredError extends Error {},
}))
vi.mock('@/lib/auth-guard', () => guard)
vi.mock('@/features/drive/sync', () => sync)
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))

const { GraphNotConfiguredError } = await import('@ihp/graph')
const {
  addLibraryFolder,
  libraryFileLink,
  listLibraryFolder,
  removeFromLibraryFolder,
  renameInLibrary,
  uploadToLibraryFolder,
} = await import('./actions')

const folder = (name: string, childCount = 0) => ({
  id: `folder-${name}`,
  name,
  folder: { childCount },
  lastModifiedDateTime: '2026-03-01T10:00:00.000Z',
})

const file = (name: string, size: number, modified: string) => ({
  id: `file-${name}`,
  name,
  size,
  file: { mimeType: 'application/pdf' },
  lastModifiedDateTime: modified,
})

beforeEach(() => {
  vi.clearAllMocks()
  graph.requireInternalDriveId.mockReturnValue('internal-drive')
  graph.rootItem.mockResolvedValue({ id: 'root-item', name: 'root', folder: { childCount: 2 } })
  graph.getItemByPath.mockResolvedValue({ id: 'clients-item', name: 'Clients', folder: {} })
  graph.getItem.mockResolvedValue({ id: 'file-1', name: 'handbook.pdf' })
  guard.membershipOf.mockReturnValue({ organizationId: 'org-1' })
})

function uploadForm(path: string, file: File) {
  const form = new FormData()
  form.set('path', path)
  form.set('file', file)
  return form
}

describe('listLibraryFolder', () => {
  it('reads the drive root when no folder is asked for', async () => {
    graph.listAllChildren.mockResolvedValue([file('plan.pdf', 2048, '2026-03-04T10:00:00.000Z')])

    const result = await listLibraryFolder({})

    expect(graph.rootItem).toHaveBeenCalledWith('internal-drive')
    expect(graph.getItemByPath).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      ok: true,
      path: '',
      entries: [
        { name: 'plan.pdf', isFolder: false, path: 'plan.pdf', contentType: 'application/pdf' },
      ],
    })
  })

  it('rebuilds a traversal attempt as a path inside the library', async () => {
    graph.listAllChildren.mockResolvedValue([])

    await listLibraryFolder({ path: '../../Clients/Acme' })

    expect(graph.getItemByPath).toHaveBeenCalledWith('internal-drive', 'Clients/Acme')
  })

  it('puts folders first and orders the rest by the column asked for', async () => {
    graph.listAllChildren.mockResolvedValue([
      file('z.pdf', 10, '2026-01-01T00:00:00.000Z'),
      folder('Acme', 3),
      file('a.pdf', 20, '2026-02-01T00:00:00.000Z'),
    ])

    const result = await listLibraryFolder({ sortBy: 'size', sortDirection: 'desc' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.entries.map((entry) => entry.name)).toEqual(['Acme', 'a.pdf', 'z.pdf'])
  })

  it('names the folder as gone when Graph cannot find it', async () => {
    graph.getItemByPath.mockRejectedValue(new TestGraphError(404, 'itemNotFound', 'gone'))

    const result = await listLibraryFolder({ path: 'Clients/Missing' })

    expect(result).toEqual({
      ok: false,
      message: 'That folder is no longer in the internal library.',
    })
  })

  it('points at the SharePoint grant when Graph refuses the read', async () => {
    graph.getItemByPath.mockRejectedValue(new TestGraphError(403, 'accessDenied', 'no'))

    const result = await listLibraryFolder({ path: 'Clients' })

    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.message).toContain('SharePoint grant')
  })

  it('says the library is not connected when Graph has no configuration', async () => {
    graph.requireInternalDriveId.mockImplementation(() => {
      throw new GraphNotConfiguredError()
    })

    const result = await listLibraryFolder({})

    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.message).toContain('GRAPH variables')
  })

  it('refuses a path that resolves to a file rather than a folder', async () => {
    graph.getItemByPath.mockResolvedValue({ id: 'file-1', name: 'plan.pdf', file: {} })

    const result = await listLibraryFolder({ path: 'plan.pdf' })

    expect(result).toMatchObject({ ok: false })
  })
})

describe('libraryFileLink', () => {
  it('mints a download URL for the item', async () => {
    const result = await libraryFileLink({ itemId: 'file-1' })

    expect(graph.downloadUrl).toHaveBeenCalledWith('internal-drive', 'file-1')
    expect(result).toEqual({ ok: true, data: { url: 'https://graph.test/download' } })
  })

  it('reports a deleted item rather than throwing', async () => {
    graph.downloadUrl.mockRejectedValue(new TestGraphError(404, 'itemNotFound', 'gone'))

    const result = await libraryFileLink({ itemId: 'file-1' })

    expect(result).toMatchObject({ ok: false })
  })

  it('rejects a request with no item id', async () => {
    const result = await libraryFileLink({})

    expect(result).toMatchObject({ ok: false })
    expect(graph.downloadUrl).not.toHaveBeenCalled()
  })
})

describe('uploadToLibraryFolder', () => {
  it('files the upload in the open folder and mirrors it at once', async () => {
    const file = new File(['bytes'], 'invoice.pdf', { type: 'application/pdf' })

    const result = await uploadToLibraryFolder(uploadForm('Clients/Acme', file))

    expect(graph.getItemByPath).toHaveBeenCalledWith('internal-drive', 'Clients/Acme')
    expect(graph.uploadFile).toHaveBeenCalledWith(
      'internal-drive',
      'clients-item',
      'invoice.pdf',
      expect.any(Uint8Array),
      'application/pdf',
    )
    expect(sync.mirrorWrite).toHaveBeenCalledWith('org-1', { id: 'new-file', name: 'invoice.pdf' })
    expect(result).toMatchObject({ ok: true, data: { name: 'invoice.pdf', isFolder: false } })
  })

  it('refuses a file past the server action body limit', async () => {
    const file = new File([''], 'huge.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 26 * 1024 * 1024 })

    const result = await uploadToLibraryFolder(uploadForm('', file))

    expect(result).toEqual({ ok: false, message: 'Files have to be 25 MB or smaller.' })
    expect(graph.uploadFile).not.toHaveBeenCalled()
  })

  it('keeps the upload when the mirror fails', async () => {
    sync.mirrorWrite.mockRejectedValueOnce(new Error('client drive refused'))
    const file = new File(['bytes'], 'invoice.pdf', { type: 'application/pdf' })

    const result = await uploadToLibraryFolder(uploadForm('Clients/Acme', file))

    expect(result).toMatchObject({ ok: true })
  })
})

describe('addLibraryFolder', () => {
  it('creates the folder and mirrors it', async () => {
    const result = await addLibraryFolder({ path: 'Clients/Acme', name: 'Invoices' })

    expect(graph.ensureFolder).toHaveBeenCalledWith('internal-drive', 'clients-item', 'Invoices')
    expect(sync.mirrorWrite).toHaveBeenCalled()
    expect(result).toMatchObject({
      ok: true,
      data: { isFolder: true, path: 'Clients/Acme/Invoices' },
    })
  })

  it('rejects a name SharePoint would refuse', async () => {
    const result = await addLibraryFolder({ path: '', name: 'Q1/Q2' })

    expect(result).toMatchObject({ ok: false })
    expect(graph.ensureFolder).not.toHaveBeenCalled()
  })
})

describe('renameInLibrary', () => {
  it('renames the item and carries the old name to the mirror', async () => {
    const result = await renameInLibrary({ itemId: 'file-1', name: 'guide.pdf' })

    expect(graph.renameItem).toHaveBeenCalledWith('internal-drive', 'file-1', 'guide.pdf')
    expect(sync.mirrorRename).toHaveBeenCalledWith(
      'org-1',
      { id: 'file-1', name: 'guide.pdf' },
      'handbook.pdf',
    )
    expect(result).toMatchObject({ ok: true, data: { name: 'guide.pdf' } })
  })
})

describe('removeFromLibraryFolder', () => {
  it('reads the item before deleting it so the copy can still be found', async () => {
    const result = await removeFromLibraryFolder({ itemId: 'file-1' })

    expect(graph.getItem).toHaveBeenCalledWith('internal-drive', 'file-1')
    expect(graph.deleteItem).toHaveBeenCalledWith('internal-drive', 'file-1')
    expect(sync.mirrorRemoval).toHaveBeenCalledWith('org-1', {
      id: 'file-1',
      name: 'handbook.pdf',
    })
    expect(result).toEqual({ ok: true, data: { id: 'file-1' } })
  })

  it('does not mirror for an account with no organization', async () => {
    guard.membershipOf.mockReturnValue({ organizationId: undefined })

    await removeFromLibraryFolder({ itemId: 'file-1' })

    expect(sync.mirrorRemoval).not.toHaveBeenCalled()
  })
})
