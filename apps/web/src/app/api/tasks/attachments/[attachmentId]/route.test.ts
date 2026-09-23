import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tasks = vi.hoisted(() => ({ attachmentDownloadUrl: vi.fn() }))

vi.mock('@/features/tasks/service', () => tasks)

const { GET } = await import('./route')
const { S3NotConfiguredError } = await import('@/lib/s3')

function open(attachmentId = 'file-1') {
  return GET(new Request(`https://portal.test/api/tasks/attachments/${attachmentId}`), {
    params: Promise.resolve({ attachmentId }),
  })
}

describe('GET /api/tasks/attachments/[attachmentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to a freshly signed link and forbids caching it', async () => {
    tasks.attachmentDownloadUrl.mockResolvedValue('https://s3.test/file-1.png?sig=fresh')

    const response = await open()

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://s3.test/file-1.png?sig=fresh')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(tasks.attachmentDownloadUrl).toHaveBeenCalledWith('file-1')
  })

  it('answers 401 to a signed-out caller and 404 for a file that is not theirs to see', async () => {
    tasks.attachmentDownloadUrl.mockRejectedValueOnce(
      new ConnectError('Sign in to continue.', Code.Unauthenticated),
    )
    expect((await open()).status).toBe(401)

    tasks.attachmentDownloadUrl.mockRejectedValueOnce(
      new ConnectError('That file is no longer there.', Code.NotFound),
    )
    const missing = await open('file-9')
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'That file is no longer there.' })
  })

  it('answers 503 when storage is not configured', async () => {
    tasks.attachmentDownloadUrl.mockRejectedValueOnce(new S3NotConfiguredError())
    expect((await open()).status).toBe(503)
  })
})
