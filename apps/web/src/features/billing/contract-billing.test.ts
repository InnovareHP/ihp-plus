import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  client: { findFirst: vi.fn() },
  contract: { findFirst: vi.fn() },
}))

const stripe = vi.hoisted(() => ({
  customers: { create: vi.fn() },
  products: { create: vi.fn() },
  subscriptions: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn(), update: vi.fn() },
  invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), sendInvoice: vi.fn() },
  invoiceItems: { create: vi.fn() },
}))

const isStripeConfigured = vi.hoisted(() => vi.fn())

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/stripe', () => ({ stripe, isStripeConfigured }))

const { syncBilling } = await import('./contract-billing')

const NOW = new Date('2026-09-14T12:00:00.000Z')
const UPDATED = new Date('2026-09-10T08:00:00.000Z')

const SENT = {
  id: 'contract-1',
  organizationId: 'org-1',
  clientId: 'client-1',
  reference: 'IHP-C-0007',
  title: 'Growth retainer',
  status: 'sent',
  billingCycle: 'monthly',
  startDate: null,
  endDate: null,
  updatedAt: UPDATED,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  lines: [
    {
      id: 'line-1',
      name: 'Social management',
      description: null,
      unitPriceCents: 250_000,
      quantity: 1,
      unit: 'month',
    },
    {
      id: 'line-2',
      name: 'Brand kit',
      description: 'Logo and palette',
      unitPriceCents: 80_000,
      quantity: 2,
      unit: 'once',
    },
  ],
}

const ACTIVE = {
  ...SENT,
  status: 'active',
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_1',
}

async function codeOf(operation: () => Promise<unknown>) {
  const error = await operation().catch((thrown: unknown) => thrown)
  return ConnectError.from(error).code
}

beforeEach(() => {
  vi.resetAllMocks()
  isStripeConfigured.mockReturnValue(true)
  prisma.contract.findFirst.mockResolvedValue(null)
  prisma.client.findFirst.mockResolvedValue({
    id: 'client-1',
    name: 'Atlantic Home Health',
    email: 'billing@atlantic.test',
    updatedAt: UPDATED,
  })
  stripe.customers.create.mockResolvedValue({ id: 'cus_1' })
  stripe.products.create.mockImplementation(async (params: { metadata: { lineId: string } }) => ({
    id: `prod_${params.metadata.lineId}`,
  }))
  stripe.subscriptions.create.mockResolvedValue({ id: 'sub_1' })
  stripe.invoices.create.mockResolvedValue({ id: 'in_1' })
})

describe('starting billing when a contract is agreed', () => {
  it('leaves the contract unbilled when Stripe is not configured', async () => {
    isStripeConfigured.mockReturnValue(false)

    expect(await syncBilling(SENT, 'active', NOW)).toBeNull()
    expect(stripe.customers.create).not.toHaveBeenCalled()
    expect(stripe.subscriptions.create).not.toHaveBeenCalled()
  })

  it('invoices a retainer monthly, with its one-off line on the first invoice only', async () => {
    expect(await syncBilling(SENT, 'active', NOW)).toEqual({
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    })

    const [params, options] = stripe.subscriptions.create.mock.calls[0] ?? []
    expect(params).toMatchObject({
      customer: 'cus_1',
      collection_method: 'send_invoice',
      days_until_due: 30,
      metadata: { contractId: 'contract-1' },
      items: [
        {
          price_data: {
            currency: 'usd',
            product: 'prod_line-1',
            unit_amount: 250_000,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      add_invoice_items: [
        { price_data: { product: 'prod_line-2', unit_amount: 80_000 }, quantity: 2 },
      ],
    })
    expect(params.add_invoice_items[0].price_data.recurring).toBeUndefined()
    expect(options).toEqual({
      idempotencyKey: `contract-contract-1-${UPDATED.getTime()}-subscription`,
    })
  })

  it('reuses the Stripe customer from an earlier contract with the same client', async () => {
    prisma.contract.findFirst.mockResolvedValue({ stripeCustomerId: 'cus_existing' })

    await syncBilling(SENT, 'active', NOW)

    expect(stripe.customers.create).not.toHaveBeenCalled()
    expect(stripe.subscriptions.create.mock.calls[0]?.[0].customer).toBe('cus_existing')
  })

  it('refuses a client with no billing email before creating anything in Stripe', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: 'client-1',
      name: 'Atlantic Home Health',
      email: null,
      updatedAt: UPDATED,
    })

    expect(await codeOf(() => syncBilling(SENT, 'active', NOW))).toBe(Code.FailedPrecondition)
    expect(stripe.products.create).not.toHaveBeenCalled()
    expect(stripe.subscriptions.create).not.toHaveBeenCalled()
  })

  it('refuses a monthly contract with nothing that recurs, as a fixable precondition', async () => {
    const setupOnly = { ...SENT, lines: SENT.lines.filter((line) => line.unit === 'once') }

    expect(await codeOf(() => syncBilling(setupOnly, 'active', NOW))).toBe(Code.FailedPrecondition)
    expect(stripe.customers.create).not.toHaveBeenCalled()
  })

  it('bills nothing before a future start date and stops on the end date', async () => {
    await syncBilling(
      {
        ...SENT,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2027-09-01T00:00:00.000Z'),
      },
      'active',
      NOW,
    )

    expect(stripe.subscriptions.create.mock.calls[0]?.[0]).toMatchObject({
      billing_cycle_anchor: 1790812800,
      proration_behavior: 'none',
      cancel_at: 1819756800,
    })
  })

  it('sends a one-off contract as one invoice, its lines added before it is finalized', async () => {
    const result = await syncBilling({ ...SENT, billingCycle: 'project' }, 'active', NOW)

    expect(result).toEqual({ stripeCustomerId: 'cus_1', stripeSubscriptionId: null })
    expect(stripe.subscriptions.create).not.toHaveBeenCalled()
    expect(stripe.invoices.create.mock.calls[0]?.[0]).toMatchObject({
      customer: 'cus_1',
      collection_method: 'send_invoice',
      pending_invoice_items_behavior: 'exclude',
      metadata: { contractId: 'contract-1' },
    })
    expect(stripe.invoiceItems.create.mock.calls.map((call) => call[0])).toMatchObject([
      { invoice: 'in_1', amount: 250_000, description: 'Social management' },
      { invoice: 'in_1', amount: 160_000, description: 'Brand kit × 2' },
    ])

    const itemAdded = stripe.invoiceItems.create.mock.invocationCallOrder.at(-1) ?? 0
    expect(stripe.invoices.finalizeInvoice.mock.invocationCallOrder[0]).toBeGreaterThan(itemAdded)
    expect(stripe.invoices.sendInvoice).toHaveBeenCalledWith('in_1', {}, expect.anything())
  })

  it('reports a Stripe failure in Stripe own words, as retryable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stripe.subscriptions.create.mockRejectedValue(
      Object.assign(new Error('No such customer: cus_1'), { type: 'StripeInvalidRequestError' }),
    )

    const error = ConnectError.from(
      await syncBilling(SENT, 'active', NOW).catch((thrown: unknown) => thrown),
    )

    expect(error.code).toBe(Code.Unavailable)
    expect(error.rawMessage).toContain('left as it was')
    expect(error.rawMessage).toContain('No such customer: cus_1')
  })

  it('keeps an internal failure message out of what the user reads', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prisma.contract.findFirst.mockRejectedValue(new Error('connection terminated unexpectedly'))

    const error = ConnectError.from(
      await syncBilling(SENT, 'active', NOW).catch((thrown: unknown) => thrown),
    )

    expect(error.code).toBe(Code.Unavailable)
    expect(error.rawMessage).not.toContain('connection terminated')
  })
})

describe('changing a contract that is already billed', () => {
  it('cancels the subscription when the contract is cancelled', async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1', status: 'active' })

    expect(await syncBilling(ACTIVE, 'cancelled', NOW)).toBeNull()
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_1')
  })

  it('does not cancel a subscription Stripe has already ended', async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1', status: 'canceled' })

    await syncBilling(ACTIVE, 'cancelled', NOW)

    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled()
  })

  it('lets the invoiced period run out when the contract is completed', async () => {
    await syncBilling(ACTIVE, 'completed', NOW)

    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', {
      cancel_at_period_end: true,
    })
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled()
  })

  it('voids invoices while paused and collects again on resume', async () => {
    await syncBilling(ACTIVE, 'paused', NOW)
    await syncBilling({ ...ACTIVE, status: 'paused' }, 'active', NOW)

    expect(stripe.subscriptions.update.mock.calls).toEqual([
      ['sub_1', { pause_collection: { behavior: 'void' } }],
      ['sub_1', { pause_collection: '' }],
    ])
    expect(stripe.subscriptions.create).not.toHaveBeenCalled()
  })

  it('touches nothing in Stripe for a contract with no subscription', async () => {
    await syncBilling(
      { ...ACTIVE, billingCycle: 'project', stripeSubscriptionId: null },
      'cancelled',
      NOW,
    )

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled()
  })
})
