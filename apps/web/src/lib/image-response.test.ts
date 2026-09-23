import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({ getObject: vi.fn() }))

vi.mock('@/lib/s3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/s3')>()),
  ...storage,
}))

const { imageResponse } = await import('./image-response')
const { S3NotConfiguredError } = await import('@/lib/s3')

function stream(text: string) {
  return new Response(text).body as ReadableStream<Uint8Array>
}

describe('imageResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('streams the picture with private caching and no sniffing', async () => {
    storage.getObject.mockResolvedValue({
      body: stream('jpeg-bytes'),
      contentType: 'image/jpeg',
      contentLength: 10,
    })

    const response = await imageResponse('users/user-1/photo.jpg', 600)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toBe('private, max-age=600')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await response.text()).toBe('jpeg-bytes')
  })

  it('will not serve something that is not a picture, or is gone', async () => {
    storage.getObject.mockResolvedValueOnce({
      body: stream('<svg onload=alert(1)>'),
      contentType: 'image/svg+xml',
      contentLength: 20,
    })
    expect((await imageResponse('users/user-1/x.svg', 600)).status).toBe(404)

    storage.getObject.mockResolvedValueOnce(null)
    expect((await imageResponse('users/user-1/gone.jpg', 600)).status).toBe(404)
  })

  it('answers 503 when storage is not configured', async () => {
    storage.getObject.mockRejectedValue(new S3NotConfiguredError())
    expect((await imageResponse('users/user-1/photo.jpg', 600)).status).toBe(503)
  })
})
