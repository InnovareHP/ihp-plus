import { beforeEach, describe, expect, it, vi } from 'vitest'

interface TestItem {
  id: string
  name: string
  folder?: { childCount?: number }
  file?: { mimeType?: string }
}

process.env.BETTER_AUTH_SECRET = 'test-secret-long-enough-to-derive-a-key'

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
  uploadFile: vi.fn(async (): Promise<TestItem> => ({ id: 'new-file', name: 'invoice.pdf' })),
  createUploadSession: vi.fn(async () => ({ uploadUrl: 'https://upload.test/session' })),
  uploadChunk: vi.fn(async (): Promise<TestItem | undefined> => undefined),
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
  listLibraryFolder,
  removeFromLibraryFolder,
  renameInLibrary,
  sendLibraryUploadChunk,
  startLibraryUpload,
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

function uploadForm(path: string, file: File, folder = '') {
  const form = new FormData()
  form.set('path', path)
  form.set('folder', folder)
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
    Object.defineProperty(file, 'size', { value: 251 * 1024 * 1024 })

    const result = await uploadToLibraryFolder(uploadForm('', file))

    expect(result).toEqual({ ok: false, message: 'Files have to be 250 MB or smaller.' })
    expect(graph.uploadFile).not.toHaveBeenCalled()
  })

  it('rebuilds a dropped folder tree that is not in the library yet', async () => {
    graph.getItemByPath.mockRejectedValueOnce(new TestGraphError(404, 'itemNotFound', 'gone'))
    graph.ensureFolder
      .mockResolvedValueOnce({ id: 'photos-item', name: 'Photos', folder: {} })
      .mockResolvedValueOnce({ id: 'q1-item', name: 'Q1-2026', folder: {} })
    const file = new File(['bytes'], 'team.jpg', { type: 'image/jpeg' })

    const result = await uploadToLibraryFolder(uploadForm('', file, 'Photos/Q1:2026'))

    expect(graph.ensureFolder).toHaveBeenNthCalledWith(1, 'internal-drive', 'root-item', 'Photos')
    expect(graph.ensureFolder).toHaveBeenNthCalledWith(
      2,
      'internal-drive',
      'photos-item',
      'Q1-2026',
    )
    expect(graph.uploadFile).toHaveBeenCalledWith(
      'internal-drive',
      'q1-item',
      'team.jpg',
      expect.any(Uint8Array),
      'image/jpeg',
    )
    expect(result).toMatchObject({ ok: true, data: { path: 'Photos/Q1-2026/invoice.pdf' } })
  })

  it('refuses a tree nested deeper than the limit', async () => {
    const file = new File(['bytes'], 'deep.txt', { type: 'text/plain' })
    const folder = Array.from({ length: 13 }, (_, index) => `level-${index}`).join('/')

    const result = await uploadToLibraryFolder(uploadForm('', file, folder))

    expect(result).toMatchObject({ ok: false })
    expect(graph.uploadFile).not.toHaveBeenCalled()
  })

  it('keeps the upload when the mirror fails', async () => {
    sync.mirrorWrite.mockRejectedValueOnce(new Error('client drive refused'))
    const file = new File(['bytes'], 'invoice.pdf', { type: 'application/pdf' })

    const result = await uploadToLibraryFolder(uploadForm('Clients/Acme', file))

    expect(result).toMatchObject({ ok: true })
  })
})

describe('chunked upload', () => {
  async function started(size = 5_000_000) {
    const result = await startLibraryUpload({ path: 'Clients', folder: '', name: 'big.zip', size })
    if (!result.ok) throw new Error(result.message)
    return result.data.token
  }

  function chunkForm(token: string, start: number, bytes: number) {
    const form = new FormData()
    form.set('token', token)
    form.set('start', String(start))
    form.set('chunk', new Blob([new Uint8Array(bytes)]))
    return form
  }

  it('opens a session and hands back a token that hides the upload URL', async () => {
    const token = await started()

    expect(graph.createUploadSession).toHaveBeenCalledWith(
      'internal-drive',
      'clients-item',
      'big.zip',
    )
    expect(token).not.toContain('upload.test')
  })

  it('sends each range on, and mirrors and returns the entry with the last one', async () => {
    const token = await started(5)
    graph.uploadChunk.mockResolvedValueOnce(undefined)
    graph.uploadChunk.mockResolvedValueOnce({ id: 'big', name: 'big.zip' })

    const first = await sendLibraryUploadChunk(chunkForm(token, 0, 3))
    const last = await sendLibraryUploadChunk(chunkForm(token, 3, 2))

    expect(graph.uploadChunk).toHaveBeenNthCalledWith(
      1,
      'https://upload.test/session',
      expect.any(Uint8Array),
      0,
      5,
    )
    expect(first).toEqual({ ok: true, data: { entry: null } })
    expect(last).toMatchObject({
      ok: true,
      data: { entry: { name: 'big.zip', path: 'Clients/big.zip' } },
    })
    expect(sync.mirrorWrite).toHaveBeenCalledTimes(1)
  })

  it('refuses a too-large file before opening a session', async () => {
    const result = await startLibraryUpload({
      path: '',
      folder: '',
      name: 'x',
      size: 251 * 1024 * 1024,
    })

    expect(result).toEqual({ ok: false, message: 'Files have to be 250 MB or smaller.' })
    expect(graph.createUploadSession).not.toHaveBeenCalled()
  })

  it('refuses a tampered token, a token of another member, and a range past the file', async () => {
    const token = await started(5)
    const tampered = `${token.slice(0, 20)}${token[20] === 'A' ? 'B' : 'A'}${token.slice(21)}`

    expect(await sendLibraryUploadChunk(chunkForm(tampered, 0, 1))).toMatchObject({ ok: false })
    expect(await sendLibraryUploadChunk(chunkForm(token, 4, 2))).toMatchObject({ ok: false })
    guard.requireOnboarded.mockResolvedValueOnce({ user: { id: 'user-2' }, profile: {} })
    expect(await sendLibraryUploadChunk(chunkForm(token, 0, 1))).toMatchObject({ ok: false })
    expect(graph.uploadChunk).not.toHaveBeenCalled()
  })

  it('reports a range SharePoint refused as an interrupted upload', async () => {
    const token = await started(5)
    graph.uploadChunk.mockRejectedValueOnce(new Error('The upload failed at byte 0 with HTTP 416.'))

    const result = await sendLibraryUploadChunk(chunkForm(token, 0, 5))

    expect(result).toEqual({
      ok: false,
      message: 'That upload was interrupted — upload the file again.',
    })
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
