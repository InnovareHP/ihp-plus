import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deltaSweep, ensureFolder, startCopy, waitForCopy } from './drive'
import { getAccessToken, resetTokenCache } from './token'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  process.env.GRAPH_TENANT_ID = 'tenant-1'
  process.env.GRAPH_CLIENT_ID = 'client-1'
  process.env.GRAPH_CLIENT_SECRET = 'secret-1'
  resetTokenCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  // Warmed here so each test queues only the Graph responses it is about.
  fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'token-1', expires_in: 3600 }))
  await getAccessToken()
  fetchMock.mockClear()
})

describe('deltaSweep', () => {
  it('follows every page and returns the link the next sweep resumes from', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        value: [{ id: 'a', name: 'a.docx' }],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/next',
      }),
    )
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        value: [{ id: 'b', name: 'b.docx' }],
        '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/delta?token=2',
      }),
    )

    const sweep = await deltaSweep('drive-1')

    expect(sweep.items.map((item) => item.id)).toEqual(['a', 'b'])
    expect(sweep.deltaLink).toBe('https://graph.microsoft.com/v1.0/delta?token=2')
  })

  it('starts from a stored link instead of the drive root', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ value: [], '@odata.deltaLink': 'next-link' }))

    await deltaSweep('drive-1', 'https://graph.microsoft.com/v1.0/delta?token=1')

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://graph.microsoft.com/v1.0/delta?token=1')
  })

  it('reports a removed item so the mirror can delete its copy', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        value: [{ id: 'a', name: 'a.docx', deleted: { state: 'deleted' } }],
        '@odata.deltaLink': 'link',
      }),
    )

    const sweep = await deltaSweep('drive-1')

    expect(sweep.items[0]?.deleted?.state).toBe('deleted')
  })
})

describe('ensureFolder', () => {
  it('returns the folder already there when Graph answers 409', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'nameAlreadyExists' } }, { status: 409 }),
    )
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ value: [{ id: 'folder-1', name: 'Acme', folder: {} }] }),
    )

    const folder = await ensureFolder('drive-1', 'root', 'Acme')

    expect(folder.id).toBe('folder-1')
  })

  it('creates the folder when it is not there yet', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'folder-2', name: 'Acme', folder: {} }))

    const folder = await ensureFolder('drive-1', 'root', 'Acme')

    expect(folder.id).toBe('folder-2')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('copy', () => {
  it('returns the monitor URL a copy has to be polled on', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('', { status: 202, headers: { location: 'https://monitor.example/1' } }),
    )

    const monitorUrl = await startCopy('drive-1', 'item-1', {
      driveId: 'drive-2',
      parentItemId: 'folder-1',
    })

    expect(monitorUrl).toBe('https://monitor.example/1')
  })

  it('polls the monitor until the copy completes and gives back the new item id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'inProgress' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'completed', resourceId: 'copy-1' }))

    const resourceId = await waitForCopy('https://monitor.example/1', { intervalMs: 0 })

    expect(resourceId).toBe('copy-1')
  })

  it('throws with the reason when Graph reports the copy failed', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'failed', error: { message: 'Quota exceeded.' } }),
    )

    await expect(waitForCopy('https://monitor.example/1', { intervalMs: 0 })).rejects.toThrow(
      'Quota exceeded.',
    )
  })

  it('gives up rather than polling a stuck copy forever', async () => {
    // A fresh Response per poll: a body can only be read once.
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ status: 'inProgress' })))

    await expect(
      waitForCopy('https://monitor.example/1', { attempts: 3, intervalMs: 0 }),
    ).rejects.toThrow('did not finish in time')
  })
})
