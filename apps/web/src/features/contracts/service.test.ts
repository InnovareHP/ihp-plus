import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contractQuerySchema } from './schema'

const prisma = vi.hoisted(() => ({
  catalogItem: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  contract: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  client: { findMany: vi.fn(), findFirst: vi.fn() },
}))

const guard = vi.hoisted(() => ({ requireOnboarded: vi.fn() }))

const billing = vi.hoisted(() => ({ syncBilling: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/features/billing/contract-billing', () => billing)
// membershipOf and canManageOrganization are pure, so the real ones are kept: the manager rule
// has one definition and this test exercises it rather than a copy.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const {
  createCatalogItem,
  createContract,
  loadContract,
  loadContractsPage,
  setContractStatus,
  updateContract,
} = await import('./service')

const listContracts = (query: Record<string, unknown> = {}) =>
  loadContractsPage(contractQuerySchema.parse(query))

async function codeOf(operation: () => Promise<unknown>) {
  const error = await operation().catch((thrown: unknown) => thrown)
  return ConnectError.from(error).code
}

function signedInAs(options: { organizationRole?: string; portalRole?: string } = {}) {
  guard.requireOnboarded.mockResolvedValue({
    user: { id: 'user-9' },
    profile: {
      role: options.portalRole ?? 'admin',
      members: [{ role: options.organizationRole ?? 'admin', organizationId: 'org-1' }],
      teammembers: [],
    },
  })
}

const CONTRACT = {
  id: 'contract-1',
  reference: 'IHP-C-0007',
  title: 'Growth retainer',
  clientId: 'client-1',
  status: 'draft',
  billingCycle: 'monthly',
  subtotalCents: 450_000,
  startDate: null,
  endDate: null,
  signedAt: null,
  createdAt: new Date('2026-03-04T00:00:00.000Z'),
  stripeSubscriptionId: null,
  stripeCustomerId: null,
}

const FULL_CONTRACT = { ...CONTRACT, terms: null, lines: [] }

/** A write reads its own row, then loadContract re-reads the whole contract. */
function queueWriteThenReload(own: unknown) {
  prisma.contract.findFirst.mockResolvedValueOnce(own).mockResolvedValueOnce(FULL_CONTRACT)
}

const DRAFT = {
  clientId: 'client-1',
  title: 'Growth retainer',
  billingCycle: 'monthly',
  startDate: '',
  endDate: '',
  terms: '',
  lines: [{ name: 'Growth', unitPriceCents: 450_000, quantity: 1, unit: 'month', description: '' }],
}

describe('loadContractsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    signedInAs()
    prisma.contract.count.mockResolvedValue(1)
    prisma.contract.findMany.mockResolvedValue([CONTRACT])
    prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Atlantic Home Health' }])
  })

  it('scopes to the caller organization and hides archived contracts', async () => {
    await listContracts({})

    const args = prisma.contract.findMany.mock.calls.at(-1)?.[0]
    expect(args.where).toMatchObject({ organizationId: 'org-1', archivedAt: null })
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }])
  })

  it('names the client on every row without joining per row', async () => {
    const page = await listContracts({})

    expect(page.rows[0]).toMatchObject({
      reference: 'IHP-C-0007',
      clientName: 'Atlantic Home Health',
      subtotalCents: 450_000,
      isBilled: false,
    })
    expect(prisma.client.findMany).toHaveBeenCalledOnce()
  })

  it('says a contract is billed once Stripe holds anything for it', async () => {
    prisma.contract.findMany.mockResolvedValue([{ ...CONTRACT, stripeSubscriptionId: 'sub_123' }])

    const page = await listContracts({})

    expect(page.rows[0]?.isBilled).toBe(true)
  })

  it('still names a row whose client was removed rather than dropping it', async () => {
    prisma.client.findMany.mockResolvedValue([])

    const page = await listContracts({})

    expect(page.rows[0]?.clientName).toBe('Removed client')
  })

  it('searches the reference and the title together', async () => {
    await listContracts({ search: 'growth' })

    const where = prisma.contract.findMany.mock.calls.at(-1)?.[0]?.where
    expect(where.OR).toEqual([
      { reference: { contains: 'growth', mode: 'insensitive' } },
      { title: { contains: 'growth', mode: 'insensitive' } },
    ])
  })

  it('refuses a caller who is in no organization', async () => {
    guard.requireOnboarded.mockResolvedValue({
      user: { id: 'user-9' },
      profile: { role: 'user', members: [], teammembers: [] },
    })

    expect(await codeOf(() => listContracts({}))).toBe(Code.FailedPrecondition)
  })
})

describe('createContract', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    signedInAs()
    prisma.client.findFirst.mockResolvedValue({ id: 'client-1' })
    prisma.contract.create.mockResolvedValue({ id: 'contract-1' })
    prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Atlantic Home Health' }])
  })

  it('numbers the next contract from the highest reference, not from a count', async () => {
    queueWriteThenReload({ reference: 'IHP-C-0007' })

    await createContract(DRAFT)

    expect(prisma.contract.create.mock.calls[0]?.[0].data.reference).toBe('IHP-C-0008')
  })

  it('starts at IHP-C-0001 for an organization with no contracts yet', async () => {
    queueWriteThenReload(null)

    await createContract(DRAFT)

    expect(prisma.contract.create.mock.calls[0]?.[0].data.reference).toBe('IHP-C-0001')
  })

  it('caches the subtotal so a list never aggregates to render a row', async () => {
    queueWriteThenReload({ reference: 'IHP-C-0007' })

    await createContract({
      ...DRAFT,
      lines: [
        { name: 'Growth', unitPriceCents: 450_000, quantity: 1, unit: 'month', description: '' },
        {
          name: 'Extra carousel',
          unitPriceCents: 30_000,
          quantity: 3,
          unit: 'project',
          description: '',
        },
      ],
    })

    // 4,500.00 + 3 × 300.00 = 5,400.00
    expect(prisma.contract.create.mock.calls[0]?.[0].data.subtotalCents).toBe(540_000)
  })

  it('refuses a contract with no services on it', async () => {
    expect(await codeOf(() => createContract({ ...DRAFT, lines: [] }))).toBe(Code.InvalidArgument)
    expect(prisma.contract.create).not.toHaveBeenCalled()
  })

  it('refuses a client from another organization', async () => {
    prisma.client.findFirst.mockResolvedValue(null)

    expect(await codeOf(() => createContract(DRAFT))).toBe(Code.NotFound)
    expect(prisma.contract.create).not.toHaveBeenCalled()
  })

  it('refuses an ordinary member, who may read contracts but not write one', async () => {
    signedInAs({ organizationRole: 'member', portalRole: 'user' })

    expect(await codeOf(() => createContract(DRAFT))).toBe(Code.PermissionDenied)
    expect(prisma.contract.create).not.toHaveBeenCalled()
  })
})

describe('setContractStatus', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    signedInAs()
    prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Atlantic Home Health' }])
    prisma.contract.update.mockResolvedValue({})
    billing.syncBilling.mockResolvedValue(null)
  })

  it('points an agreed contract at the Stripe objects billing created', async () => {
    billing.syncBilling.mockResolvedValue({
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    })
    queueWriteThenReload({ id: 'contract-1', signedAt: null, status: 'sent' })

    await setContractStatus({ contractId: 'contract-1', status: 'active' })

    expect(billing.syncBilling).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'contract-1', organizationId: 'org-1' }),
      'active',
    )
    expect(prisma.contract.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'active',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    })
  })

  it('leaves the contract as it was when Stripe refuses the change', async () => {
    billing.syncBilling.mockRejectedValue(new ConnectError('Stripe is down', Code.Unavailable))
    queueWriteThenReload({ id: 'contract-1', signedAt: null, status: 'sent' })

    expect(
      await codeOf(() => setContractStatus({ contractId: 'contract-1', status: 'active' })),
    ).toBe(Code.Unavailable)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it('checks the transition before anything reaches Stripe', async () => {
    queueWriteThenReload({ id: 'contract-1', signedAt: null, status: 'draft' })

    await codeOf(() => setContractStatus({ contractId: 'contract-1', status: 'active' }))

    expect(billing.syncBilling).not.toHaveBeenCalled()
  })

  it('stamps signedAt the first time a contract goes active', async () => {
    queueWriteThenReload({ id: 'contract-1', signedAt: null, status: 'sent' })

    await setContractStatus({ contractId: 'contract-1', status: 'active' })

    expect(prisma.contract.update.mock.calls[0]?.[0].data.signedAt).toBeInstanceOf(Date)
  })

  it('keeps the original signing date when a paused contract resumes', async () => {
    const signedAt = new Date('2026-01-05T00:00:00.000Z')
    queueWriteThenReload({ id: 'contract-1', signedAt, status: 'paused' })

    await setContractStatus({ contractId: 'contract-1', status: 'active' })

    expect(prisma.contract.update.mock.calls[0]?.[0].data.signedAt).toBe(signedAt)
  })

  it('refuses a transition the flow does not allow', async () => {
    // Straight from draft to active would skip showing it to the client.
    queueWriteThenReload({ id: 'contract-1', signedAt: null, status: 'draft' })

    expect(
      await codeOf(() => setContractStatus({ contractId: 'contract-1', status: 'active' })),
    ).toBe(Code.FailedPrecondition)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it('refuses to reopen a cancelled contract', async () => {
    queueWriteThenReload({ id: 'contract-1', signedAt: null, status: 'cancelled' })

    expect(
      await codeOf(() => setContractStatus({ contractId: 'contract-1', status: 'active' })),
    ).toBe(Code.FailedPrecondition)
  })

  it('lets a draft be published to the client', async () => {
    queueWriteThenReload({ id: 'contract-1', signedAt: null, status: 'draft' })

    await setContractStatus({ contractId: 'contract-1', status: 'sent' })

    expect(prisma.contract.update.mock.calls[0]?.[0].data.status).toBe('sent')
  })

  it('leaves a draft unsigned', async () => {
    queueWriteThenReload({ id: 'contract-1', signedAt: null, status: 'draft' })

    await setContractStatus({ contractId: 'contract-1', status: 'sent' })

    expect(prisma.contract.update.mock.calls[0]?.[0].data.signedAt).toBeNull()
  })
})

describe('updateContract', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    signedInAs()
    prisma.client.findFirst.mockResolvedValue({ id: 'client-1' })
    prisma.contract.update.mockResolvedValue({})
    prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Atlantic Home Health' }])
  })

  const EDIT = { ...DRAFT, contractId: 'contract-1' }

  it('re-prices a draft and replaces its lines wholesale', async () => {
    queueWriteThenReload({ id: 'contract-1', status: 'draft' })

    await updateContract({
      ...EDIT,
      lines: [
        { name: 'Growth', unitPriceCents: 400_000, quantity: 2, unit: 'month', description: '' },
      ],
    })

    const data = prisma.contract.update.mock.calls[0]?.[0].data
    expect(data.subtotalCents).toBe(800_000)
    // deleteMany before create: a line has no identity of its own once it is re-priced.
    expect(data.lines.deleteMany).toEqual({})
    expect(data.lines.create).toHaveLength(1)
  })

  it('refuses to edit a contract the client has already been sent', async () => {
    queueWriteThenReload({ id: 'contract-1', status: 'sent' })

    expect(await codeOf(() => updateContract(EDIT))).toBe(Code.FailedPrecondition)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it('refuses to edit an active contract, whatever the caller sends', async () => {
    queueWriteThenReload({ id: 'contract-1', status: 'active' })

    expect(await codeOf(() => updateContract(EDIT))).toBe(Code.FailedPrecondition)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it('refuses an ordinary member', async () => {
    signedInAs({ organizationRole: 'member', portalRole: 'user' })

    expect(await codeOf(() => updateContract(EDIT))).toBe(Code.PermissionDenied)
  })
})

describe('catalog', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    signedInAs()
  })

  it('refuses a price range that runs backwards', async () => {
    const code = await codeOf(() =>
      createCatalogItem({
        category: 'creative',
        name: 'Brand Identity Design',
        description: '',
        priceMinCents: 700_000,
        priceMaxCents: 300_000,
        unit: 'project',
      }),
    )

    expect(code).toBe(Code.InvalidArgument)
    expect(prisma.catalogItem.create).not.toHaveBeenCalled()
  })

  it('refuses a duplicate of a service already on the card', async () => {
    prisma.catalogItem.findFirst.mockResolvedValue({ id: 'catalog-1' })

    const code = await codeOf(() =>
      createCatalogItem({
        category: 'bundle',
        name: 'Growth',
        description: '',
        priceMinCents: 450_000,
        priceMaxCents: 450_000,
        unit: 'month',
      }),
    )

    expect(code).toBe(Code.AlreadyExists)
  })
})

describe('loadContract', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    signedInAs()
  })

  it('reports a contract in another organization as missing, not forbidden', async () => {
    prisma.contract.findFirst.mockResolvedValue(null)

    expect(await codeOf(() => loadContract('contract-1'))).toBe(Code.NotFound)
  })
})
