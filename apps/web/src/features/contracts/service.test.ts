import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contractQuerySchema } from './schema'

const prisma = vi.hoisted(() => ({
  catalogItem: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  lookupOption: { findMany: vi.fn() },
  contract: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  client: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  stripeInvoice: { findMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({ requireOnboarded: vi.fn() }))

const billing = vi.hoisted(() => ({ syncBilling: vi.fn() }))
const email = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  portalUrl: vi.fn((route: string) => `https://portal.ihp.test/app${route}`),
  contractPublishedTemplate: vi.fn(),
  contractStatusChangedTemplate: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/features/billing/contract-billing', () => billing)
vi.mock('@/lib/email', () => email)
vi.mock('@/lib/activity', () => activity)

const activity = vi.hoisted(() => ({ recordActivity: vi.fn(), loadActivity: vi.fn() }))
vi.mock('./client-link', () => ({
  clientContractUrl: (contractId: string) =>
    `https://portal.ihp.test/app/contract/${contractId}/sig`,
}))
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
  loadContractActivity,
  loadContractInvoices,
  loadContractsPage,
  setContractStatus,
  updateContract,
  loadCatalog,
  setCatalogItemArchived,
  updateCatalogItem,
} = await import('./service')

const listContracts = (query: Record<string, unknown> = {}) =>
  loadContractsPage(contractQuerySchema.parse(query))

async function codeOf(operation: () => Promise<unknown>) {
  const error = await operation().catch((thrown: unknown) => thrown)
  return ConnectError.from(error).code
}

function signedInAs(options: { organizationRole?: string; portalRole?: string } = {}) {
  guard.requireOnboarded.mockResolvedValue({
    user: { id: 'user-9', name: 'Ada Lovelace' },
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
    prisma.client.findFirst.mockResolvedValue({
      name: 'Atlantic Home Health',
      email: 'billing@atlantic.test',
    })
    prisma.organization.findUnique.mockResolvedValue({ name: 'IHP+' })
    email.contractPublishedTemplate.mockReturnValue({ subject: 'Ready', html: '<p/>', text: '' })
  })

  it('emails the client a freshly signed link when a draft is published', async () => {
    queueWriteThenReload({
      id: 'contract-1',
      signedAt: null,
      status: 'draft',
      clientId: 'client-1',
      reference: 'IHP-C-0007',
      title: 'Growth retainer',
    })

    await setContractStatus({ contractId: 'contract-1', status: 'sent' })

    expect(prisma.contract.update.mock.calls[0]?.[0].data.sharedAt).toBeInstanceOf(Date)
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'billing@atlantic.test' }),
    )
    expect(email.contractPublishedTemplate).toHaveBeenCalledWith({
      organizationName: 'IHP+',
      reference: 'IHP-C-0007',
      title: 'Growth retainer',
      url: 'https://portal.ihp.test/app/contract/contract-1/sig',
    })
  })

  it('refuses to publish to a client with no email, before anything changes', async () => {
    prisma.client.findFirst.mockResolvedValue({ name: 'Atlantic Home Health', email: null })
    queueWriteThenReload({
      id: 'contract-1',
      signedAt: null,
      status: 'draft',
      clientId: 'client-1',
    })

    expect(
      await codeOf(() => setContractStatus({ contractId: 'contract-1', status: 'sent' })),
    ).toBe(Code.FailedPrecondition)
    expect(prisma.contract.update).not.toHaveBeenCalled()
    expect(email.sendEmail).not.toHaveBeenCalled()
  })

  it('tells the contract owner when somebody else moves it', async () => {
    email.portalUrl.mockImplementation((route: string) => `https://portal.ihp.test/app${route}`)
    email.contractStatusChangedTemplate.mockReturnValue({
      subject: 'Moved',
      html: '<p/>',
      text: '',
    })
    prisma.user.findUnique.mockResolvedValue({ email: 'owner@ihp.test' })
    prisma.client.findUnique.mockResolvedValue({ name: 'Atlantic Home Health' })
    queueWriteThenReload({
      id: 'contract-1',
      signedAt: null,
      status: 'sent',
      clientId: 'client-1',
      ownerId: 'user-2',
      reference: 'IHP-C-0007',
      title: 'Growth retainer',
    })

    await setContractStatus({ contractId: 'contract-1', status: 'cancelled' })

    expect(email.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@ihp.test' }))
    expect(email.contractStatusChangedTemplate).toHaveBeenCalledWith({
      reference: 'IHP-C-0007',
      title: 'Growth retainer',
      clientName: 'Atlantic Home Health',
      statusLabel: 'cancelled',
      changedByName: 'Ada Lovelace',
      url: 'https://portal.ihp.test/app/clients?tab=contracts',
    })
  })

  it('stays quiet when the owner is the one moving their own contract', async () => {
    queueWriteThenReload({
      id: 'contract-1',
      signedAt: null,
      status: 'sent',
      clientId: 'client-1',
      ownerId: 'user-9',
      reference: 'IHP-C-0007',
      title: 'Growth retainer',
    })

    await setContractStatus({ contractId: 'contract-1', status: 'cancelled' })

    expect(email.sendEmail).not.toHaveBeenCalled()
  })

  it('retires the client link when a contract returns to draft', async () => {
    queueWriteThenReload({ id: 'contract-1', signedAt: null, status: 'sent' })

    await setContractStatus({ contractId: 'contract-1', status: 'draft' })

    expect(prisma.contract.update.mock.calls[0]?.[0].data).toMatchObject({
      sharedAt: null,
      viewedAt: null,
    })
    expect(email.sendEmail).not.toHaveBeenCalled()
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

describe('contract history', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    guard.requireOnboarded.mockResolvedValue({
      user: { id: 'user-9', name: 'Ada Lovelace' },
      profile: {
        role: 'admin',
        members: [{ role: 'admin', organizationId: 'org-1' }],
        teammembers: [],
      },
    })
    prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Atlantic Home Health' }])
    prisma.contract.update.mockResolvedValue({})
    billing.syncBilling.mockResolvedValue(null)
  })

  it('records who changed a status, told apart from a first agreement', async () => {
    queueWriteThenReload({ id: 'contract-1', signedAt: new Date(), status: 'paused' })

    await setContractStatus({ contractId: 'contract-1', status: 'active' })

    expect(activity.recordActivity).toHaveBeenCalledWith({
      organizationId: 'org-1',
      subjectType: 'contract',
      subjectId: 'contract-1',
      action: 'contract.resumed',
      actorId: 'user-9',
      actorName: 'Ada Lovelace',
    })
  })

  it('records nothing when the change is refused', async () => {
    queueWriteThenReload({ id: 'contract-1', signedAt: null, status: 'cancelled' })

    await codeOf(() => setContractStatus({ contractId: 'contract-1', status: 'active' }))

    expect(activity.recordActivity).not.toHaveBeenCalled()
  })

  it('reads history only for a contract inside the caller organization', async () => {
    prisma.contract.findFirst.mockResolvedValue(null)

    expect(await codeOf(() => loadContractActivity('contract-9'))).toBe(Code.NotFound)
    expect(activity.loadActivity).not.toHaveBeenCalled()
  })
})

describe('loadContractInvoices', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    signedInAs()
  })

  it('lists what Stripe billed for the contract, newest first, in cents', async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: 'contract-1' })
    prisma.stripeInvoice.findMany.mockResolvedValue([
      {
        id: 'in_1',
        status: 'paid',
        amountDueCents: 250_000,
        amountPaidCents: 250_000,
        currency: 'usd',
        hostedInvoiceUrl: 'https://invoice.stripe.com/i/1',
        paidAt: new Date('2026-09-02T00:00:00.000Z'),
        failedAt: null,
        failureReason: null,
        periodStart: null,
        periodEnd: null,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    ])

    const invoices = await loadContractInvoices('contract-1')

    expect(prisma.stripeInvoice.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { contractId: 'contract-1' },
      orderBy: { createdAt: 'desc' },
    })
    expect(invoices).toEqual([
      {
        id: 'in_1',
        status: 'paid',
        amountDueCents: 250_000,
        amountPaidCents: 250_000,
        currency: 'usd',
        hostedInvoiceUrl: 'https://invoice.stripe.com/i/1',
        paidAt: '2026-09-02T00:00:00.000Z',
        failedAt: undefined,
        failureReason: undefined,
        periodStart: undefined,
        periodEnd: undefined,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ])
  })

  it('never reads invoices for a contract outside the caller organization', async () => {
    prisma.contract.findFirst.mockResolvedValue(null)

    expect(await codeOf(() => loadContractInvoices('contract-9'))).toBe(Code.NotFound)
    expect(prisma.stripeInvoice.findMany).not.toHaveBeenCalled()
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
        category: 'Creative services',
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

  it('refuses a section that is not on the list', async () => {
    prisma.lookupOption.findMany.mockResolvedValue([{ value: 'Website', sortOrder: 0 }])

    const code = await codeOf(() =>
      createCatalogItem({
        category: 'Made up',
        name: 'Landing page',
        description: '',
        priceMinCents: 100_000,
        priceMaxCents: 100_000,
        unit: 'project',
      }),
    )

    expect(code).toBe(Code.InvalidArgument)
    expect(prisma.catalogItem.create).not.toHaveBeenCalled()
  })

  it('files a service under a section an admin added', async () => {
    prisma.lookupOption.findMany.mockResolvedValue([{ value: 'IT department', sortOrder: 0 }])
    prisma.catalogItem.findFirst.mockResolvedValue(null)
    prisma.catalogItem.create.mockImplementation(async ({ data }) => ({
      id: 'catalog-2',
      ...data,
    }))

    const created = await createCatalogItem({
      category: 'IT department',
      name: 'Help desk',
      description: '',
      priceMinCents: 50_000,
      priceMaxCents: 50_000,
      unit: 'month',
    })

    expect(created.category).toBe('IT department')
    expect(prisma.catalogItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category: 'IT department' }) }),
    )
  })

  it('refuses a duplicate of a service already on the card', async () => {
    prisma.lookupOption.findMany.mockResolvedValue([{ value: 'Bundles', sortOrder: 0 }])
    prisma.catalogItem.findFirst.mockResolvedValue({ id: 'catalog-1' })

    const code = await codeOf(() =>
      createCatalogItem({
        category: 'Bundles',
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

describe('editing and retiring rate card services', () => {
  const EDIT = {
    category: 'Creative services',
    name: 'Logo design',
    description: 'A mark, its variants and a style sheet',
    priceMinCents: 200_000,
    priceMaxCents: 350_000,
    unit: 'project' as const,
  }

  beforeEach(() => {
    vi.resetAllMocks()
    signedInAs()
    prisma.lookupOption.findMany.mockResolvedValue([{ value: 'Creative services', sortOrder: 0 }])
    prisma.catalogItem.update.mockImplementation(async ({ data }) => ({
      ...{
        id: 'catalog-1',
        category: 'Creative services',
        name: 'Logo design',
        description: null,
        priceMinCents: 150_000,
        priceMaxCents: 300_000,
        unit: 'project',
        percentOfSpend: null,
        defaultTerms: null,
        archivedAt: null,
      },
      ...data,
    }))
  })

  it('corrects a service in place', async () => {
    prisma.catalogItem.findFirst
      .mockResolvedValueOnce({ id: 'catalog-1', category: 'Creative services' })
      .mockResolvedValueOnce(null)

    const updated = await updateCatalogItem('catalog-1', EDIT)

    expect(prisma.catalogItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'catalog-1' },
        data: expect.objectContaining({ priceMinCents: 200_000, priceMaxCents: 350_000 }),
      }),
    )
    expect(updated).toMatchObject({ priceMinCents: 200_000, archived: false })
  })

  it('keeps a service in a section since removed from the list, but moves nothing new into it', async () => {
    prisma.lookupOption.findMany.mockResolvedValue([{ value: 'Website', sortOrder: 0 }])
    prisma.catalogItem.findFirst
      .mockResolvedValueOnce({ id: 'catalog-1', category: 'Creative services' })
      .mockResolvedValueOnce(null)
    await expect(updateCatalogItem('catalog-1', EDIT)).resolves.toBeDefined()

    prisma.catalogItem.findFirst.mockResolvedValueOnce({ id: 'catalog-1', category: 'Website' })
    expect(await codeOf(() => updateCatalogItem('catalog-1', EDIT))).toBe(Code.InvalidArgument)
  })

  it('refuses a rename onto another service, and says to restore an archived one', async () => {
    prisma.catalogItem.findFirst
      .mockResolvedValueOnce({ id: 'catalog-1', category: 'Creative services' })
      .mockResolvedValueOnce({ archivedAt: new Date('2026-09-01T00:00:00.000Z') })

    const error = await updateCatalogItem('catalog-1', EDIT).catch((thrown: unknown) =>
      ConnectError.from(thrown),
    )
    expect(error).toMatchObject({
      code: Code.AlreadyExists,
      rawMessage: 'An archived service already has that name in this section. Restore it instead.',
    })
    expect(prisma.catalogItem.update).not.toHaveBeenCalled()
  })

  it('archives and restores, and only a manager may', async () => {
    prisma.catalogItem.findFirst.mockResolvedValue({
      id: 'catalog-1',
      category: 'Creative services',
    })

    await setCatalogItemArchived('catalog-1', true)
    expect(prisma.catalogItem.update.mock.calls[0]?.[0].data.archivedAt).toBeInstanceOf(Date)

    await setCatalogItemArchived('catalog-1', false)
    expect(prisma.catalogItem.update.mock.calls[1]?.[0].data).toEqual({ archivedAt: null })

    signedInAs({ organizationRole: 'member', portalRole: 'user' })
    expect(await codeOf(() => setCatalogItemArchived('catalog-1', true))).toBe(
      Code.PermissionDenied,
    )
  })

  it('says a service in another organization is gone', async () => {
    prisma.catalogItem.findFirst.mockResolvedValue(null)

    expect(await codeOf(() => setCatalogItemArchived('catalog-9', true))).toBe(Code.NotFound)
  })

  it('shows archived services to a manager who asks, and to nobody else', async () => {
    prisma.catalogItem.findMany.mockResolvedValue([])

    await loadCatalog(true)
    expect(prisma.catalogItem.findMany.mock.calls[0]?.[0].where.archivedAt).toBeUndefined()

    await loadCatalog()
    expect(prisma.catalogItem.findMany.mock.calls[1]?.[0].where.archivedAt).toBeNull()

    signedInAs({ organizationRole: 'member', portalRole: 'user' })
    expect(await codeOf(() => loadCatalog(true))).toBe(Code.PermissionDenied)
  })
})
