import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const bulletin = vi.hoisted(() => ({ bulletinImageKey: vi.fn() }))
const images = vi.hoisted(() => ({ imageResponse: vi.fn() }))

vi.mock('@/features/bulletin/service', () => bulletin)
vi.mock('@/lib/image-response', () => images)

const { GET } = await import('./route')

function open(imageId: string) {
  return GET(new Request(`https://portal.test/api/bulletin/images/${imageId}`), {
    params: Promise.resolve({ imageId }),
  })
}

describe('GET /api/bulletin/images/[imageId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    images.imageResponse.mockResolvedValue(new Response('ok'))
  })

  it('serves the stored photo with a day of private cache', async () => {
    bulletin.bulletinImageKey.mockResolvedValue('bulletin/org-1/a.jpg')

    await open('img-1')

    expect(bulletin.bulletinImageKey).toHaveBeenCalledWith('img-1')
    expect(images.imageResponse).toHaveBeenCalledWith('bulletin/org-1/a.jpg', 86400)
  })

  it('answers 401 without a session and 404 for a photo that is not there', async () => {
    bulletin.bulletinImageKey.mockRejectedValueOnce(
      new ConnectError('Sign in to continue.', Code.Unauthenticated),
    )
    expect((await open('img-1')).status).toBe(401)

    bulletin.bulletinImageKey.mockRejectedValueOnce(
      new ConnectError('That photo is no longer on the board.', Code.NotFound),
    )
    expect((await open('img-9')).status).toBe(404)
  })
})
