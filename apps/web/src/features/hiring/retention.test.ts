import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  jobApplication: { findMany: vi.fn(), deleteMany: vi.fn() },
  applicationAttachment: { findMany: vi.fn(), deleteMany: vi.fn() },
}))
const s3 = vi.hoisted(() => ({ deleteObject: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/s3', () => s3)

const { RETENTION_MS, STRAY_UPLOAD_MS, sweepHiringData } = await import('./retention')

const NOW = new Date('2026-10-01T04:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  prisma.jobApplication.findMany.mockResolvedValue([
    { id: 'app-old', attachments: [{ fileKey: 'hiring/org-1/post-1/cv.pdf' }] },
  ])
  prisma.applicationAttachment.findMany.mockResolvedValue([
    { id: 'file-stray', fileKey: 'hiring/org-1/post-1/stray.pdf' },
  ])
  s3.deleteObject.mockResolvedValue(undefined)
})

describe('sweepHiringData', () => {
  it('deletes decided applications a year on, and uploads nobody sent after a day', async () => {
    expect(await sweepHiringData(NOW)).toEqual({ applications: 1, strayFiles: 1 })

    expect(prisma.jobApplication.findMany.mock.calls[0]?.[0].where).toEqual({
      status: { not: 'active' },
      decidedAt: { lt: new Date(NOW.getTime() - RETENTION_MS) },
    })
    expect(prisma.applicationAttachment.findMany.mock.calls[0]?.[0].where).toEqual({
      applicationId: null,
      createdAt: { lt: new Date(NOW.getTime() - STRAY_UPLOAD_MS) },
    })
    expect(s3.deleteObject).toHaveBeenCalledWith('hiring/org-1/post-1/cv.pdf')
    expect(s3.deleteObject).toHaveBeenCalledWith('hiring/org-1/post-1/stray.pdf')
    expect(prisma.jobApplication.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['app-old'] } },
    })
  })

  it('keeps the rows when storage refuses, so tomorrow’s run tries again', async () => {
    s3.deleteObject.mockRejectedValue(new Error('storage down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await sweepHiringData(NOW)).toEqual({ applications: 0, strayFiles: 0 })
    expect(prisma.jobApplication.deleteMany).not.toHaveBeenCalled()
    expect(prisma.applicationAttachment.deleteMany).not.toHaveBeenCalled()
  })

  it('does nothing on a quiet day', async () => {
    prisma.jobApplication.findMany.mockResolvedValue([])
    prisma.applicationAttachment.findMany.mockResolvedValue([])

    expect(await sweepHiringData(NOW)).toEqual({ applications: 0, strayFiles: 0 })
    expect(prisma.jobApplication.deleteMany).not.toHaveBeenCalled()
  })
})
