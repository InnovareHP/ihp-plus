import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const attendance = vi.hoisted(() => ({ selfieKeyFor: vi.fn() }))
const images = vi.hoisted(() => ({ imageResponse: vi.fn() }))

vi.mock('@/features/attendance/service', () => attendance)
vi.mock('@/lib/image-response', () => images)

const { GET } = await import('./route')

function open(side: string) {
  return GET(new Request(`https://portal.test/api/attendance/selfies/day-1?side=${side}`), {
    params: Promise.resolve({ dayId: 'day-1' }),
  })
}

describe('GET /api/attendance/selfies/[dayId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    images.imageResponse.mockResolvedValue(new Response('ok'))
  })

  it('serves the photo for the end of the day asked for', async () => {
    attendance.selfieKeyFor.mockResolvedValue('attendance/org-1/user-1/in.jpg')

    await open('in')

    expect(attendance.selfieKeyFor).toHaveBeenCalledWith('day-1', 'in')
    expect(images.imageResponse).toHaveBeenCalledWith('attendance/org-1/user-1/in.jpg', 3600)
  })

  it('refuses a side that is neither in nor out', async () => {
    expect((await open('sideways')).status).toBe(400)
    expect(attendance.selfieKeyFor).not.toHaveBeenCalled()
  })

  it('answers 403 to a member and 404 for a day with no photo', async () => {
    attendance.selfieKeyFor.mockRejectedValueOnce(
      new ConnectError('Only an admin sees the photos taken at the clock.', Code.PermissionDenied),
    )
    expect((await open('in')).status).toBe(403)

    attendance.selfieKeyFor.mockRejectedValueOnce(
      new ConnectError('That photo is no longer there.', Code.NotFound),
    )
    expect((await open('out')).status).toBe(404)
  })
})
