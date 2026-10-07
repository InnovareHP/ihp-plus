import { beforeEach, describe, expect, it, vi } from 'vitest'

const guard = vi.hoisted(() => ({
  getSession: vi.fn(),
  readProfile: vi.fn(),
}))

const service = vi.hoisted(() => ({
  NotAFileError: class NotAFileError extends Error {},
  readLibraryFile: vi.fn(),
}))

const graph = vi.hoisted(() => ({
  GraphError: class GraphError extends Error {
    constructor(readonly status: number) {
      super('graph')
    }
    get isNotFound() {
      return this.status === 404
    }
  },
  GraphNotConfiguredError: class GraphNotConfiguredError extends Error {},
}))

vi.mock('@ihp/graph', () => graph)
vi.mock('@/lib/auth-guard', () => guard)
vi.mock('@/features/library/service', () => service)

const { GET } = await import('./route')

const ITEM = {
  id: 'file-1',
  name: 'team photo.jpg',
  cTag: '"c:{AB},2"',
  file: { mimeType: 'image/jpeg' },
}

function get(search = '', headers: Record<string, string> = {}) {
  return GET(new Request(`https://portal.test/api/library/files/file-1${search}`, { headers }), {
    params: Promise.resolve({ itemId: 'file-1' }),
  })
}

const open = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  guard.getSession.mockResolvedValue({ user: { id: 'user-1' } })
  guard.readProfile.mockResolvedValue({ onboardingCompletedAt: new Date() })
  open.mockImplementation(async () => new Response('bytes', { headers: { 'content-length': '5' } }))
  service.readLibraryFile.mockResolvedValue({ item: ITEM, open })
})

describe('GET /api/library/files/[itemId]', () => {
  it('streams the file from our origin with a private cache and an ETag', async () => {
    const response = await get()

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('bytes')
    expect(open).toHaveBeenCalledWith('original')
    expect(response.headers.get('cache-control')).toBe('private, max-age=86400')
    expect(response.headers.get('etag')).toBe('"cAB2-original"')
    expect(response.headers.get('content-disposition')).toMatch(/^inline;/)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('answers 304 without fetching the bytes when the browser copy is current', async () => {
    const response = await get('', { 'if-none-match': '"cAB2-original"' })

    expect(response.status).toBe(304)
    expect(open).not.toHaveBeenCalled()
  })

  it('serves the thumbnail rendition, and a forced download as an attachment', async () => {
    await get('?rendition=thumbnail')
    expect(open).toHaveBeenCalledWith('thumbnail')

    const download = await get('?download=1')
    expect(download.headers.get('content-disposition')).toMatch(/^attachment;/)
  })

  it('never renders HTML inline on our origin', async () => {
    service.readLibraryFile.mockResolvedValue({
      item: { ...ITEM, name: 'page.html', file: { mimeType: 'text/html' } },
      open,
    })

    const response = await get()

    expect(response.headers.get('content-disposition')).toMatch(/^attachment;/)
  })

  it('answers 401 without a session and 403 before onboarding', async () => {
    guard.getSession.mockResolvedValueOnce(null)
    expect((await get()).status).toBe(401)

    guard.readProfile.mockResolvedValueOnce({ onboardingCompletedAt: null })
    expect((await get()).status).toBe(403)
    expect(service.readLibraryFile).not.toHaveBeenCalled()
  })

  it('answers 404 for a missing file or a folder, 502 when SharePoint fails', async () => {
    service.readLibraryFile.mockRejectedValueOnce(new graph.GraphError(404))
    expect((await get()).status).toBe(404)

    service.readLibraryFile.mockRejectedValueOnce(new service.NotAFileError())
    expect((await get()).status).toBe(404)

    service.readLibraryFile.mockRejectedValueOnce(new graph.GraphError(500))
    expect((await get()).status).toBe(502)
  })
})
