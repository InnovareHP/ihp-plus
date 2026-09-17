import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DriveItem } from '@ihp/graph'

const graph = vi.hoisted(() => ({
  deltaSweep: vi.fn(),
  copyItem: vi.fn(async () => 'target-1'),
  deleteItem: vi.fn(),
  ensureFolder: vi.fn(async (_driveId: string, _parentId: string, name: string) => ({
    id: `folder-${name}`,
    name,
    webUrl: `https://sharepoint.test/${name}`,
  })),
  requireClientDriveId: vi.fn(() => 'client-drive'),
  rootItem: vi.fn(async () => ({ id: 'client-root', name: 'root' })),
}))

const service = vi.hoisted(() => ({
  subscriptionForDrive: vi.fn(),
  saveSweep: vi.fn(),
  saveSweepError: vi.fn(),
  clientByFolderName: vi.fn(),
  clientDriveFolder: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
  saveClientDriveFolder: vi.fn(),
  mirrorFor: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
  saveMirror: vi.fn(),
  markMirrorRemoved: vi.fn(),
}))

vi.mock('@ihp/graph', async () => ({
  ...graph,
  GraphError: class GraphError extends Error {
    readonly status: number
    constructor(status: number) {
      super('graph')
      this.status = status
    }
    get isNotFound() {
      return this.status === 404
    }
  },
}))
vi.mock('./service', () => service)
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))

const { syncDrive } = await import('./sync')

function file(name: string, parentPath: string, extra: Partial<DriveItem> = {}): DriveItem {
  return {
    id: `src-${name}`,
    name,
    eTag: 'etag-1',
    parentReference: { path: parentPath },
    ...extra,
  }
}

function sweep(items: DriveItem[]) {
  graph.deltaSweep.mockResolvedValueOnce({ items, deltaLink: 'delta-2' })
}

beforeEach(() => {
  vi.clearAllMocks()
  service.subscriptionForDrive.mockResolvedValue({
    organizationId: 'org-1',
    driveId: 'internal-drive',
    deltaLink: 'delta-1',
  })
  service.clientByFolderName.mockResolvedValue({ id: 'client-1', name: 'Acme' })
  service.clientDriveFolder.mockResolvedValue(null)
  service.mirrorFor.mockResolvedValue(null)
  graph.ensureFolder.mockImplementation(async (_driveId, _parentId, name: string) => ({
    id: `folder-${name}`,
    name,
    webUrl: `https://sharepoint.test/${name}`,
  }))
  graph.copyItem.mockResolvedValue('target-1')
})

describe('syncDrive', () => {
  it('resumes from the stored delta link and saves the next one', async () => {
    sweep([])

    await syncDrive('internal-drive')

    expect(graph.deltaSweep).toHaveBeenCalledWith('internal-drive', 'delta-1')
    expect(service.saveSweep).toHaveBeenCalledWith('internal-drive', 'delta-2')
  })

  it('copies a file from a client’s folder into that client’s folder', async () => {
    sweep([file('sow.pdf', '/drive/root:/Clients/Acme')])

    const outcome = await syncDrive('internal-drive')

    expect(graph.copyItem).toHaveBeenCalledWith('internal-drive', 'src-sow.pdf', {
      driveId: 'client-drive',
      parentItemId: 'folder-Acme',
      name: 'sow.pdf',
    })
    expect(service.saveMirror).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1', targetItemId: 'target-1', state: 'synced' }),
    )
    expect(outcome.copied).toBe(1)
  })

  it('leaves a file filed outside Clients alone', async () => {
    sweep([file('handbook.pdf', '/drive/root:/Bluebook')])

    const outcome = await syncDrive('internal-drive')

    expect(graph.copyItem).not.toHaveBeenCalled()
    expect(outcome.skipped).toBe(1)
  })

  it('skips a file whose eTag has not moved since the last sweep', async () => {
    service.mirrorFor.mockResolvedValue({
      id: 'mirror-1',
      state: 'synced',
      sourceEtag: 'etag-1',
      targetItemId: 'target-1',
    })
    sweep([file('sow.pdf', '/drive/root:/Clients/Acme')])

    const outcome = await syncDrive('internal-drive')

    expect(graph.copyItem).not.toHaveBeenCalled()
    expect(outcome.skipped).toBe(1)
  })

  it('replaces the copy when the source changed', async () => {
    service.mirrorFor.mockResolvedValue({
      id: 'mirror-1',
      state: 'synced',
      sourceEtag: 'etag-0',
      targetItemId: 'target-old',
    })
    sweep([file('sow.pdf', '/drive/root:/Clients/Acme')])

    const outcome = await syncDrive('internal-drive')

    expect(graph.deleteItem).toHaveBeenCalledWith('client-drive', 'target-old')
    expect(graph.copyItem).toHaveBeenCalled()
    expect(outcome.updated).toBe(1)
  })

  it('deletes the client’s copy when the source is deleted', async () => {
    service.mirrorFor.mockResolvedValue({
      id: 'mirror-1',
      state: 'synced',
      sourceEtag: 'etag-1',
      targetItemId: 'target-1',
    })
    sweep([file('sow.pdf', '/drive/root:/Clients/Acme', { deleted: { state: 'deleted' } })])

    const outcome = await syncDrive('internal-drive')

    expect(graph.deleteItem).toHaveBeenCalledWith('client-drive', 'target-1')
    expect(service.markMirrorRemoved).toHaveBeenCalledWith('mirror-1')
    expect(outcome.removed).toBe(1)
  })

  it('withdraws the copy when a file is moved out of the client’s folder', async () => {
    service.mirrorFor.mockResolvedValue({
      id: 'mirror-1',
      state: 'synced',
      sourceEtag: 'etag-1',
      targetItemId: 'target-1',
    })
    sweep([file('sow.pdf', '/drive/root:/Bluebook')])

    const outcome = await syncDrive('internal-drive')

    expect(graph.deleteItem).toHaveBeenCalledWith('client-drive', 'target-1')
    expect(outcome.removed).toBe(1)
  })

  it('does not share a folder named after a client the CRM does not have', async () => {
    service.clientByFolderName.mockResolvedValue(null)
    sweep([file('sow.pdf', '/drive/root:/Clients/Ghost Ltd')])

    const outcome = await syncDrive('internal-drive')

    expect(graph.copyItem).not.toHaveBeenCalled()
    expect(outcome.skipped).toBe(1)
  })

  it('creates the subfolders a nested file needs before copying it', async () => {
    sweep([file('q1.xlsx', '/drive/root:/Clients/Acme/Reports/2026')])

    await syncDrive('internal-drive')

    expect(graph.ensureFolder.mock.calls.map((call) => call[2])).toEqual([
      'Acme',
      'Reports',
      '2026',
    ])
    expect(graph.copyItem).toHaveBeenCalledWith(
      'internal-drive',
      'src-q1.xlsx',
      expect.objectContaining({ parentItemId: 'folder-2026' }),
    )
  })

  it('records the failure and keeps sweeping when one copy fails', async () => {
    graph.copyItem.mockRejectedValueOnce(new Error('Quota exceeded.'))
    sweep([file('a.pdf', '/drive/root:/Clients/Acme'), file('b.pdf', '/drive/root:/Clients/Acme')])

    const outcome = await syncDrive('internal-drive')

    expect(outcome.failed).toBe(1)
    expect(outcome.copied).toBe(1)
    expect(service.saveMirror).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'failed', lastError: 'Quota exceeded.' }),
    )
  })

  it('keeps the delta link when the sweep itself fails, so nothing is lost', async () => {
    graph.deltaSweep.mockRejectedValueOnce(new Error('Graph is down.'))

    await expect(syncDrive('internal-drive')).rejects.toThrow('Graph is down.')
    expect(service.saveSweep).not.toHaveBeenCalled()
    expect(service.saveSweepError).toHaveBeenCalledWith('internal-drive', 'Graph is down.')
  })
})
