import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  organization: { findMany: vi.fn() },
  bulletinSettings: { findMany: vi.fn() },
  attendanceSettings: { findMany: vi.fn() },
  member: { findMany: vi.fn() },
  bulletinPost: { createMany: vi.fn() },
}))

vi.mock('@ihp/db', () => ({ db: prisma }))

const { postCelebrations } = await import('./celebrations')

function member(organizationId: string, userId: string, dateOfBirth: string) {
  return {
    organizationId,
    userId,
    user: {
      name: `Person ${userId}`,
      preferredName: null,
      dateOfBirth: new Date(dateOfBirth),
      startDate: null,
      onboardingCompletedAt: null,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prisma.organization.findMany.mockResolvedValue([{ id: 'org-ph' }, { id: 'org-us' }])
  prisma.bulletinSettings.findMany.mockResolvedValue([])
  prisma.attendanceSettings.findMany.mockResolvedValue([
    { organizationId: 'org-ph', timeZone: 'Asia/Manila' },
    { organizationId: 'org-us', timeZone: 'America/Los_Angeles' },
  ])
  prisma.bulletinPost.createMany.mockResolvedValue({ count: 1 })
})

describe('postCelebrations', () => {
  it('uses each organization’s own date, and posts idempotently', async () => {
    // 00:30 UTC on the 26th is the 26th in Manila but still the 25th in Los Angeles.
    prisma.member.findMany.mockResolvedValue([
      member('org-ph', 'ph-1', '1990-09-26T00:00:00.000Z'),
      member('org-us', 'us-1', '1990-09-25T00:00:00.000Z'),
      member('org-us', 'us-2', '1990-09-26T00:00:00.000Z'),
    ])

    const posted = await postCelebrations(new Date('2026-09-26T00:30:00.000Z'))

    expect(posted).toBe(2)
    expect(prisma.bulletinPost.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ organizationId: 'org-ph', subjectUserId: 'ph-1' })],
      skipDuplicates: true,
    })
    expect(prisma.bulletinPost.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          organizationId: 'org-us',
          subjectUserId: 'us-1',
          authorId: null,
          kind: 'birthday',
        }),
      ],
      skipDuplicates: true,
    })
  })

  it('writes nothing on a day with nothing to celebrate', async () => {
    prisma.member.findMany.mockResolvedValue([member('org-ph', 'ph-1', '1990-01-01T00:00:00.000Z')])

    expect(await postCelebrations(new Date('2026-09-26T00:30:00.000Z'))).toBe(0)
    expect(prisma.bulletinPost.createMany).not.toHaveBeenCalled()
  })
})
