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
}))

const guard = vi.hoisted(() => ({
  requireOnboarded: vi.fn(async () => ({ user: { id: 'user-1' }, profile: {} })),
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

const { GraphNotConfiguredError } = await import('@ihp/graph')
const { libraryFileLink, listLibraryFolder } = await import('./actions')

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
})

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
