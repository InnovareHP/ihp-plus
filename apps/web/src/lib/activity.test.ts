import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({ activityEvent: { create: vi.fn(), findMany: vi.fn() } }))

vi.mock('@ihp/db', () => ({ db: prisma }))

const { loadActivity, recordActivity } = await import('./activity')

const ENTRY = {
  organizationId: 'org-1',
  subjectType: 'contract' as const,
  subjectId: 'contract-1',
  action: 'contract.published' as const,
  actorId: 'user-1',
  actorName: 'Ada Lovelace',
}

describe('recordActivity', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('appends the entry with a bounded detail', async () => {
    await recordActivity({ ...ENTRY, detail: 'x'.repeat(900) })

    const data = prisma.activityEvent.create.mock.calls[0]?.[0].data
    expect(data).toMatchObject({ ...ENTRY })
    expect(data.detail).toHaveLength(500)
  })

  it('logs rather than throws, because the change it records already happened', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prisma.activityEvent.create.mockRejectedValue(new Error('connection reset'))

    await expect(recordActivity(ENTRY)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('loadActivity', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('reads one subject oldest first, inside the organization, in words', async () => {
    prisma.activityEvent.findMany.mockResolvedValue([
      {
        id: 'a-1',
        action: 'contract.published',
        actorName: 'Ada Lovelace',
        detail: null,
        createdAt: new Date('2026-09-14T09:00:00.000Z'),
      },
    ])

    const items = await loadActivity('org-1', 'contract', 'contract-1')

    expect(prisma.activityEvent.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-1', subjectType: 'contract', subjectId: 'contract-1' },
      orderBy: { createdAt: 'asc' },
    })
    expect(items).toEqual([
      {
        id: 'a-1',
        label: 'Published to the client',
        actorName: 'Ada Lovelace',
        detail: undefined,
        createdAt: '2026-09-14T09:00:00.000Z',
      },
    ])
  })
})
