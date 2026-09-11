import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  lookupOption: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
  },
  organization: { findFirst: vi.fn() },
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/auth-guard', () => ({
  getSession: vi.fn(),
  readProfile: vi.fn(),
  membershipOf: vi.fn(),
}))

const { addOptions, listManyFor, retireOption } = await import('./service')

beforeEach(() => {
  vi.clearAllMocks()
  prisma.lookupOption.findMany.mockResolvedValue([])
  prisma.lookupOption.findFirst.mockResolvedValue({ sortOrder: 4 })
  prisma.lookupOption.createMany.mockResolvedValue({ count: 2 })
  prisma.lookupOption.updateMany.mockResolvedValue({ count: 1 })
})

describe('listManyFor', () => {
  it('reads several dropdowns in one query and groups them by kind', async () => {
    prisma.lookupOption.findMany.mockResolvedValue([
      { kind: 'position', value: 'Case Manager' },
      { kind: 'position', value: 'Physician' },
      { kind: 'clientTag', value: 'Medicare' },
    ])

    const grouped = await listManyFor('org-1', ['position', 'clientTag', 'clientCity'])

    expect(prisma.lookupOption.findMany).toHaveBeenCalledTimes(1)
    expect(grouped.get('position')).toEqual(['Case Manager', 'Physician'])
    expect(grouped.get('clientTag')).toEqual(['Medicare'])
    // A kind with nothing in it still answers, so a caller never handles undefined.
    expect(grouped.get('clientCity')).toEqual([])
  })

  it('leaves retired values out', async () => {
    await listManyFor('org-1', ['position'])

    expect(prisma.lookupOption.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-1', kind: { in: ['position'] }, archivedAt: null },
    })
  })
})

describe('addOptions', () => {
  it('appends after the last value of that kind', async () => {
    const counts = await addOptions('org-1', 'clientType', ['Hospice', 'Payer', 'Broker'])

    expect(prisma.lookupOption.createMany.mock.calls[0]?.[0]).toEqual({
      data: [
        { organizationId: 'org-1', kind: 'clientType', value: 'Hospice', sortOrder: 5 },
        { organizationId: 'org-1', kind: 'clientType', value: 'Payer', sortOrder: 6 },
        { organizationId: 'org-1', kind: 'clientType', value: 'Broker', sortOrder: 7 },
      ],
      skipDuplicates: true,
    })
    // Two of three rows were written, so the third was already in the list.
    expect(counts).toEqual({ added: 2, skipped: 1 })
  })

  it('starts at zero for a kind with nothing in it yet', async () => {
    prisma.lookupOption.findFirst.mockResolvedValue(null)

    await addOptions('org-1', 'clientCity', ['Trenton'])

    expect(prisma.lookupOption.createMany.mock.calls[0]?.[0].data[0]).toMatchObject({
      sortOrder: 0,
    })
  })
})

describe('retireOption', () => {
  it('archives the value rather than deleting it, scoped to the organization', async () => {
    const retired = await retireOption('org-1', 'clientType', 'Hospice')

    const args = prisma.lookupOption.updateMany.mock.calls[0]?.[0]
    expect(args.where).toEqual({
      organizationId: 'org-1',
      kind: 'clientType',
      value: 'Hospice',
      archivedAt: null,
    })
    expect(args.data.archivedAt).toBeInstanceOf(Date)
    expect(retired).toBe(true)
  })

  it('reports false when nothing was live to retire', async () => {
    prisma.lookupOption.updateMany.mockResolvedValue({ count: 0 })

    expect(await retireOption('org-1', 'clientType', 'Hospice')).toBe(false)
  })
})
