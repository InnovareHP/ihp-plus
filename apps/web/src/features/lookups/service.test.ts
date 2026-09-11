import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  lookupOption: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
  },
  organization: { findMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
// membershipOf is pure, so the real one is kept: how a membership resolves has one definition.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))
vi.mock('@/lib/auth', () => ({ auth: { api: {} } }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))

const { addOptions, listManyFor, loadOptions, retireOption } = await import('./service')

function signedIn({ organizationId }: { organizationId?: string } = {}) {
  guard.getSession.mockResolvedValue({ user: { id: 'user-1' } })
  guard.readProfile.mockResolvedValue({
    role: 'user',
    members: organizationId ? [{ role: 'member', organizationId }] : [],
    teammembers: [],
  })
}

async function codeOf(operation: () => Promise<unknown>) {
  const error = await operation().catch((thrown: unknown) => thrown)
  return ConnectError.from(error).code
}

describe('loadOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedIn({ organizationId: 'org-1' })
    prisma.lookupOption.findMany.mockResolvedValue([{ value: 'Physician', sortOrder: 0 }])
    prisma.organization.findMany.mockResolvedValue([{ id: 'org-sole' }])
  })

  it('reads the list of the organization the caller belongs to', async () => {
    const options = await loadOptions('position')

    expect(options).toEqual([{ value: 'Physician', sortOrder: 0 }])
    expect(prisma.lookupOption.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-1', kind: 'position', archivedAt: null },
    })
    // A membership settles it, so the company is never looked up at all.
    expect(prisma.organization.findMany).not.toHaveBeenCalled()
  })

  it('falls back to the one company for someone still onboarding', async () => {
    signedIn()

    await loadOptions('position')

    expect(prisma.lookupOption.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-sole' },
    })
  })

  it('refuses to guess when more than one organization exists', async () => {
    signedIn()
    prisma.organization.findMany.mockResolvedValue([{ id: 'org-a' }, { id: 'org-b' }])

    expect(await codeOf(() => loadOptions('position'))).toBe(Code.FailedPrecondition)
    expect(prisma.lookupOption.findMany).not.toHaveBeenCalled()
  })

  it('refuses a kind that is not a curated list', async () => {
    expect(await codeOf(() => loadOptions('organizationRole'))).toBe(Code.InvalidArgument)
    expect(prisma.lookupOption.findMany).not.toHaveBeenCalled()
  })

  it('turns an anonymous caller away before touching the table', async () => {
    guard.getSession.mockResolvedValue(null)

    expect(await codeOf(() => loadOptions('position'))).toBe(Code.Unauthenticated)
    expect(prisma.lookupOption.findMany).not.toHaveBeenCalled()
  })
})

describe('listManyFor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.lookupOption.findMany.mockResolvedValue([
      { kind: 'position', value: 'Case Manager' },
      { kind: 'position', value: 'Physician' },
      { kind: 'clientTag', value: 'Medicare' },
    ])
  })

  it('reads several dropdowns in one query and groups them by kind', async () => {
    const grouped = await listManyFor('org-1', ['position', 'clientTag', 'clientCity'])

    expect(prisma.lookupOption.findMany).toHaveBeenCalledTimes(1)
    expect(grouped.get('position')).toEqual(['Case Manager', 'Physician'])
    expect(grouped.get('clientTag')).toEqual(['Medicare'])
    // A kind with nothing in it still answers, so no caller handles undefined.
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
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.lookupOption.findFirst.mockResolvedValue({ sortOrder: 4 })
    prisma.lookupOption.createMany.mockResolvedValue({ count: 2 })
  })

  it('appends a pasted list after the last value of that kind', async () => {
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
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.lookupOption.updateMany.mockResolvedValue({ count: 1 })
  })

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
