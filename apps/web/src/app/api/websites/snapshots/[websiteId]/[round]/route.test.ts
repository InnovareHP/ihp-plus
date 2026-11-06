import { beforeEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => ({ websitesAccess: vi.fn() }))
const service = vi.hoisted(() => ({ todaysSnapshotKey: vi.fn() }))
const images = vi.hoisted(() => ({ imageResponse: vi.fn() }))

vi.mock('@/features/websites/access', () => access)
vi.mock('@/features/websites/service', () => service)
vi.mock('@/lib/image-response', () => images)

const { GET } = await import('./route')

function open(round: string, size = 'thumb', websiteId = 'site-1') {
  return GET(
    new Request(`https://portal.test/api/websites/snapshots/${websiteId}/${round}?size=${size}`),
    { params: Promise.resolve({ websiteId, round }) },
  )
}

describe('GET /api/websites/snapshots/[websiteId]/[round]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    access.websitesAccess.mockResolvedValue({ canView: true, organizationId: 'org-1' })
    images.imageResponse.mockResolvedValue(new Response('ok'))
  })

  it('serves today’s picture of the round and size asked for', async () => {
    service.todaysSnapshotKey.mockResolvedValue('website-snapshots/org-1/day/site-1/x.webp')

    await open('clock_in', 'full')

    expect(service.todaysSnapshotKey).toHaveBeenCalledWith('org-1', 'site-1', 'clock_in', 'full')
    expect(images.imageResponse).toHaveBeenCalledWith(
      'website-snapshots/org-1/day/site-1/x.webp',
      86400,
    )
  })

  it('refuses a round or size that does not exist', async () => {
    expect((await open('lunch')).status).toBe(400)
    expect((await open('clock_in', 'huge')).status).toBe(400)
    expect(service.todaysSnapshotKey).not.toHaveBeenCalled()
  })

  it('answers 404 to anyone outside IT, without saying more', async () => {
    access.websitesAccess.mockResolvedValue({ canView: false, organizationId: 'org-1' })

    expect((await open('clock_in')).status).toBe(404)
    expect(service.todaysSnapshotKey).not.toHaveBeenCalled()
  })

  it('answers 404 for a site from another organization', async () => {
    service.todaysSnapshotKey.mockResolvedValue(undefined)

    expect((await open('clock_out', 'thumb', 'elsewhere')).status).toBe(404)
    expect(images.imageResponse).not.toHaveBeenCalled()
  })
})
