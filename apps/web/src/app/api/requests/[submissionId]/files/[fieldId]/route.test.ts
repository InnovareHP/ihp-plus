import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requests = vi.hoisted(() => ({ requestFileUrl: vi.fn() }))

vi.mock('@/features/requests/service', () => requests)

const { GET } = await import('./route')
const { S3NotConfiguredError } = await import('@/lib/s3')

function open(submissionId = 'request-1', fieldId = 'receipt') {
  return GET(new Request(`https://portal.test/api/requests/${submissionId}/files/${fieldId}`), {
    params: Promise.resolve({ submissionId, fieldId }),
  })
}

describe('GET /api/requests/[submissionId]/files/[fieldId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to a freshly signed link and forbids caching it', async () => {
    requests.requestFileUrl.mockResolvedValue('https://s3.test/receipt.pdf?sig=fresh')

    const response = await open()

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://s3.test/receipt.pdf?sig=fresh')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(requests.requestFileUrl).toHaveBeenCalledWith('request-1', 'receipt')
  })

  it('answers 403 to a caller who may not read the request and 404 for a missing file', async () => {
    requests.requestFileUrl.mockRejectedValueOnce(
      new ConnectError('That file is not yours to open.', Code.PermissionDenied),
    )
    expect((await open()).status).toBe(403)

    requests.requestFileUrl.mockRejectedValueOnce(
      new ConnectError('That file is no longer there.', Code.NotFound),
    )
    const missing = await open('request-9')
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'That file is no longer there.' })
  })

  it('answers 503 when storage is not configured', async () => {
    requests.requestFileUrl.mockRejectedValueOnce(new S3NotConfiguredError())
    expect((await open()).status).toBe(503)
  })
})
