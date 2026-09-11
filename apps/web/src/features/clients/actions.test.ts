import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_CLIENT_DRAFT } from './schema'

const prisma = vi.hoisted(() => ({
  client: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  lookupOption: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
  user: { findMany: vi.fn() },
  member: { findMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({
  requireOnboarded: vi.fn(),
  membershipOf: vi.fn((): { organizationId: string | undefined } => ({ organizationId: 'org-1' })),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/auth-guard', () => guard)

const {
  archiveClient,
  createClient,
  listClientFilterOptions,
  listClients,
  restoreClient,
  updateClient,
} = await import('./actions')

const CLIENT = {
  id: 'client-1',
  organizationId: 'org-1',
  ownerId: 'user-2',
  createdById: 'user-1',
  name: 'Riverside Care Center',
  contactName: 'Dana Reyes',
  email: 'dana@riversidecare.com',
  phone: '(609) 555-0134',
  status: 'active',
  type: 'Skilled nursing facility',
  serviceLine: 'Post-acute network',
  source: 'Referral',
  city: 'Trenton',
  state: 'NJ',
  tags: ['Medicare'],
  notes: null,
  lastContactAt: new Date('2026-03-04T00:00:00.000Z'),
  archivedAt: null,
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  updatedAt: new Date('2026-03-04T00:00:00.000Z'),
}

const DRAFT = { ...EMPTY_CLIENT_DRAFT, name: 'Riverside Care Center' }

async function argsFor(query: Record<string, unknown>) {
  await listClients(query)
  return prisma.client.findMany.mock.calls.at(-1)?.[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  guard.requireOnboarded.mockResolvedValue({ user: { id: 'user-1' }, profile: {} })
  guard.membershipOf.mockReturnValue({ organizationId: 'org-1' })
  prisma.client.count.mockResolvedValue(1)
  prisma.client.findMany.mockResolvedValue([CLIENT])
  prisma.client.findUnique.mockResolvedValue(CLIENT)
  prisma.client.create.mockResolvedValue(CLIENT)
  prisma.client.updateMany.mockResolvedValue({ count: 1 })
  prisma.user.findMany.mockResolvedValue([{ id: 'user-2', name: 'Grace Hopper' }])
  prisma.member.findMany.mockResolvedValue([{ user: { id: 'user-2', name: 'Grace Hopper' } }])
  prisma.lookupOption.findMany.mockResolvedValue([
    { kind: 'clientType', value: 'Hospital' },
    { kind: 'clientTag', value: 'Medicare' },
  ])
  prisma.lookupOption.findFirst.mockResolvedValue({ sortOrder: 4 })
  prisma.lookupOption.createMany.mockResolvedValue({ count: 2 })
  prisma.lookupOption.updateMany.mockResolvedValue({ count: 1 })
})

describe('listClients', () => {
  it('refuses an account with no organization without touching the table', async () => {
    guard.membershipOf.mockReturnValue({ organizationId: undefined })

    expect(await listClients({})).toMatchObject({ ok: false })
    expect(prisma.client.findMany).not.toHaveBeenCalled()
  })

  it('lists the live clients of the caller organization with a stable tiebreaker', async () => {
    const args = await argsFor({})

    expect(args.where).toEqual({ organizationId: 'org-1', archivedAt: null })
    expect(args.orderBy).toEqual([{ name: 'asc' }, { id: 'asc' }])
    expect(args).toMatchObject({ skip: 0, take: 25 })
  })

  it('serves the archive as its own view', async () => {
    const args = await argsFor({ view: 'archived' })

    expect(args.where).toMatchObject({ archivedAt: { not: null } })
  })

  it('searches the name, contact, email, phone and city at once', async () => {
    const args = await argsFor({ search: 'dana' })

    expect(args.where.AND).toEqual([
      {
        OR: [
          { name: { contains: 'dana', mode: 'insensitive' } },
          { contactName: { contains: 'dana', mode: 'insensitive' } },
          { email: { contains: 'dana', mode: 'insensitive' } },
          { phone: { contains: 'dana', mode: 'insensitive' } },
          { city: { contains: 'dana', mode: 'insensitive' } },
        ],
      },
    ])
  })

  it('filters the curated dropdown fields, and tags with hasSome', async () => {
    const args = await argsFor({
      types: 'Hospital,Hospice',
      serviceLines: 'Care management',
      sources: 'Referral',
      states: 'NJ',
      tags: 'Medicare,Expansion',
    })

    expect(args.where.AND).toEqual([
      { type: { in: ['Hospital', 'Hospice'] } },
      { serviceLine: { in: ['Care management'] } },
      { source: { in: ['Referral'] } },
      { state: { in: ['NJ'] } },
      // hasSome: two tags asks for clients carrying either, not both.
      { tags: { hasSome: ['Medicare', 'Expansion'] } },
    ])
  })

  it('treats "unassigned" as a null owner rather than an id', async () => {
    const args = await argsFor({ ownerIds: 'unassigned,user-2' })

    expect(args.where.AND).toEqual([{ OR: [{ ownerId: { in: ['user-2'] } }, { ownerId: null }] }])
  })

  it('resolves the owner name in one lookup and hands back ISO dates', async () => {
    const result = await listClients({})

    expect(prisma.user.findMany).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      ok: true,
      rows: [
        {
          id: 'client-1',
          ownerId: 'user-2',
          ownerName: 'Grace Hopper',
          notes: '',
          lastContactAt: '2026-03-04T00:00:00.000Z',
          archivedAt: undefined,
        },
      ],
    })
  })

  it('serves the last page when the requested one is past the end', async () => {
    prisma.client.count.mockResolvedValue(30)

    const result = await listClients({ page: 99, pageSize: 25 })

    expect(prisma.client.findMany.mock.calls.at(-1)?.[0]).toMatchObject({ skip: 25 })
    expect(result).toMatchObject({ pageInfo: { page: 2, pageCount: 2 } })
  })
})

describe('createClient', () => {
  it('stores blanks as null and stamps the organization and author', async () => {
    await createClient({ ...DRAFT, email: '', city: ' Trenton ', lastContactAt: '2026-03-04' })

    expect(prisma.client.create.mock.calls[0]?.[0]).toEqual({
      data: {
        name: 'Riverside Care Center',
        contactName: null,
        email: null,
        phone: null,
        status: 'prospect',
        type: null,
        serviceLine: null,
        source: null,
        city: 'Trenton',
        state: null,
        tags: [],
        ownerId: null,
        notes: null,
        lastContactAt: new Date('2026-03-04T00:00:00.000Z'),
        organizationId: 'org-1',
        createdById: 'user-1',
      },
    })
  })

  it('rejects an invalid draft before it reaches the table', async () => {
    expect(await createClient({ ...DRAFT, name: 'R' })).toMatchObject({ ok: false })
    expect(prisma.client.create).not.toHaveBeenCalled()
  })
})

describe('updateClient', () => {
  it('matches on the organization too, so an id from elsewhere cannot be edited', async () => {
    await updateClient({ ...DRAFT, id: 'client-1' })

    expect(prisma.client.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'client-1', organizationId: 'org-1' },
    })
  })

  it('reports a client that no longer exists instead of pretending it saved', async () => {
    prisma.client.updateMany.mockResolvedValue({ count: 0 })

    expect(await updateClient({ ...DRAFT, id: 'gone' })).toEqual({
      ok: false,
      message: 'That client no longer exists.',
    })
  })
})

describe('listClientFilterOptions', () => {
  it('reads the client dropdowns from the one lookup table, grouped by field', async () => {
    const result = await listClientFilterOptions()

    expect(prisma.lookupOption.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        organizationId: 'org-1',
        kind: {
          in: [
            'clientType',
            'clientServiceLine',
            'clientSource',
            'clientCity',
            'clientState',
            'clientTag',
          ],
        },
        archivedAt: null,
      },
    })
    expect(result).toMatchObject({
      ok: true,
      data: {
        owners: [{ id: 'user-2', name: 'Grace Hopper' }],
        options: {
          clientType: ['Hospital'],
          clientTag: ['Medicare'],
          clientSource: [],
        },
      },
    })
  })
})

describe('archiveClient and restoreClient', () => {
  it('stamps and clears archivedAt within the organization', async () => {
    await archiveClient({ id: 'client-1' })
    const archived = prisma.client.updateMany.mock.calls[0]?.[0]
    expect(archived.where).toEqual({ id: 'client-1', organizationId: 'org-1' })
    expect(archived.data.archivedAt).toBeInstanceOf(Date)

    await restoreClient({ id: 'client-1' })
    expect(prisma.client.updateMany.mock.calls[1]?.[0]).toMatchObject({
      data: { archivedAt: null },
    })
  })
})
