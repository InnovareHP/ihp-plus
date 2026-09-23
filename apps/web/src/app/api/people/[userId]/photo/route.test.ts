import { beforeEach, describe, expect, it, vi } from 'vitest'

const photos = vi.hoisted(() => ({ profilePhotoKey: vi.fn() }))
const images = vi.hoisted(() => ({ imageResponse: vi.fn() }))

vi.mock('@/lib/profile-photo', () => photos)
vi.mock('@/lib/image-response', () => images)

const { GET } = await import('./route')

function open(query = '') {
  return GET(new Request(`https://portal.test/api/people/user-2/photo${query}`), {
    params: Promise.resolve({ userId: 'user-2' }),
  })
}

describe('GET /api/people/[userId]/photo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    images.imageResponse.mockResolvedValue(new Response('ok'))
  })

  it('serves the saved photo with a day of private caching', async () => {
    photos.profilePhotoKey.mockResolvedValue({ status: 'ok', key: 'users/user-2/photo.jpg' })

    await open('?v=photo.jpg')

    expect(photos.profilePhotoKey).toHaveBeenCalledWith('user-2', undefined)
    expect(images.imageResponse).toHaveBeenCalledWith('users/user-2/photo.jpg', 86400)
  })

  it('never caches a pending upload, which can be replaced any second', async () => {
    photos.profilePhotoKey.mockResolvedValue({ status: 'ok', key: 'users/user-2/new.jpg' })

    await open('?pending=users%2Fuser-2%2Fnew.jpg')

    expect(photos.profilePhotoKey).toHaveBeenCalledWith('user-2', 'users/user-2/new.jpg')
    expect(images.imageResponse).toHaveBeenCalledWith('users/user-2/new.jpg', 0)
  })

  it('answers 401 signed out and 404 for someone the caller cannot see', async () => {
    photos.profilePhotoKey.mockResolvedValueOnce({ status: 'unauthenticated' })
    expect((await open()).status).toBe(401)

    photos.profilePhotoKey.mockResolvedValueOnce({ status: 'not-found' })
    expect((await open()).status).toBe(404)
    expect(images.imageResponse).not.toHaveBeenCalled()
  })
})
