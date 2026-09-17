import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

const prisma = vi.hoisted(() => ({
  stripeEvent: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  stripeInvoice: { upsert: vi.fn() },
  contract: { findFirst: vi.fn(), update: vi.fn() },
}))

vi.mock('@ihp/db', () => ({ db: prisma }))

const { claimEvent, handleEvent } = await import('./service')

function event(type: string, object: unknown) {
  return { id: 'evt_1', type, data: { object } } as unknown as Stripe.Event
}

const INVOICE = {
  id: 'in_1',
  customer: 'cus_1',
  status: 'paid',
  amount_due: 120000,
  amount_paid: 120000,
  currency: 'usd',
  hosted_invoice_url: 'https://invoice.stripe.com/x',
  attempt_count: 1,
  period_start: 1767225600,
  period_end: 1769904000,
  status_transitions: { paid_at: 1767312000 },
  parent: { subscription_details: { subscription: 'sub_1' } },
}

describe('claimEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.stripeEvent.findUnique.mockResolvedValue(null)
  })

  it('records a new event under Stripe own id, which is the idempotency key', async () => {
    const result = await claimEvent(event('invoice.paid', INVOICE))

    expect(result).toEqual({ alreadyProcessed: false })
    expect(prisma.stripeEvent.upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'evt_1' },
      create: { id: 'evt_1', type: 'invoice.paid', attempts: 1 },
    })
  })

  it('reports a redelivery of something already done, without touching the row', async () => {
    prisma.stripeEvent.findUnique.mockResolvedValue({ processedAt: new Date() })

    expect(await claimEvent(event('invoice.paid', INVOICE))).toEqual({ alreadyProcessed: true })
    expect(prisma.stripeEvent.upsert).not.toHaveBeenCalled()
  })

  it('counts another attempt when an earlier one failed rather than starting over', async () => {
    prisma.stripeEvent.findUnique.mockResolvedValue({ processedAt: null })

    await claimEvent(event('invoice.paid', INVOICE))

    expect(prisma.stripeEvent.upsert.mock.calls[0]?.[0].update).toEqual({
      attempts: { increment: 1 },
    })
  })
})

describe('handleEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.contract.findFirst.mockResolvedValue({ id: 'contract-1', status: 'active' })
  })

  it('ignores an event type the portal does not act on', async () => {
    expect(await handleEvent(event('customer.created', { id: 'cus_1' }))).toBe('ignored')
    expect(prisma.stripeInvoice.upsert).not.toHaveBeenCalled()
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it('mirrors a paid invoice in cents, with the contract it belongs to', async () => {
    expect(await handleEvent(event('invoice.paid', INVOICE))).toBe('handled')

    const args = prisma.stripeInvoice.upsert.mock.calls[0]?.[0]
    expect(args.where).toEqual({ id: 'in_1' })
    expect(args.create).toMatchObject({
      id: 'in_1',
      contractId: 'contract-1',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      status: 'paid',
      amountDueCents: 120000,
      amountPaidCents: 120000,
      currency: 'usd',
      failedAt: null,
    })
    expect(args.create.paidAt).toBeInstanceOf(Date)
  })

  it('records why a payment failed, so the portal can say more than "failed"', async () => {
    const failed = {
      ...INVOICE,
      status: 'open',
      amount_paid: 0,
      status_transitions: {},
      payment_intent: { last_payment_error: { message: 'Your card was declined.' } },
    }

    await handleEvent(event('invoice.payment_failed', failed))

    expect(prisma.stripeInvoice.upsert.mock.calls[0]?.[0].create).toMatchObject({
      status: 'open',
      amountPaidCents: 0,
      failureReason: 'Your card was declined.',
      paidAt: null,
    })
  })

  it('leaves an invoice for a customer with no contract unlinked rather than failing', async () => {
    prisma.contract.findFirst.mockResolvedValue(null)

    expect(await handleEvent(event('invoice.paid', INVOICE))).toBe('handled')
    expect(prisma.stripeInvoice.upsert.mock.calls[0]?.[0].create.contractId).toBeNull()
  })

  it('cancels the contract when its subscription is deleted', async () => {
    await handleEvent(
      event('customer.subscription.deleted', {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'canceled',
      }),
    )

    expect(prisma.contract.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'contract-1' },
      data: { status: 'cancelled', stripeSubscriptionId: 'sub_1' },
    })
  })

  it('pauses and resumes the contract with the subscription', async () => {
    await handleEvent(
      event('customer.subscription.paused', { id: 'sub_1', customer: 'cus_1', status: 'paused' }),
    )
    expect(prisma.contract.update.mock.calls[0]?.[0].data).toMatchObject({ status: 'paused' })

    await handleEvent(
      event('customer.subscription.resumed', { id: 'sub_1', customer: 'cus_1', status: 'active' }),
    )
    expect(prisma.contract.update.mock.calls[1]?.[0].data).toMatchObject({ status: 'active' })
  })

  it('leaves the contract status alone when an invoice is merely late', async () => {
    // past_due is a billing fact, not a change to what was agreed; the invoice carries it.
    await handleEvent(
      event('customer.subscription.updated', {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'past_due',
      }),
    )

    const data = prisma.contract.update.mock.calls[0]?.[0].data
    expect(data).toMatchObject({ stripeSubscriptionId: 'sub_1' })
    expect(data.status).toBeUndefined()
  })

  it('links an invoice by the contract id the portal tagged it with', async () => {
    await handleEvent(
      event('invoice.finalized', {
        ...INVOICE,
        parent: null,
        metadata: { contractId: 'contract-9' },
      }),
    )

    expect(prisma.contract.findFirst.mock.calls[0]?.[0].where).toEqual({ id: 'contract-9' })
  })

  it('reads the contract id a subscription passes down to its invoices', async () => {
    const parent = {
      subscription_details: { subscription: 'sub_1', metadata: { contractId: 'contract-3' } },
    }

    await handleEvent(event('invoice.paid', { ...INVOICE, parent }))

    expect(prisma.contract.findFirst.mock.calls[0]?.[0].where).toEqual({ id: 'contract-3' })
  })

  it('never picks a contract by customer alone, since one client can hold several', async () => {
    await handleEvent(event('invoice.paid', { ...INVOICE, parent: null }))

    expect(prisma.contract.findFirst).not.toHaveBeenCalled()
    expect(prisma.stripeInvoice.upsert.mock.calls[0]?.[0].create.contractId).toBeNull()
  })

  it('finds the contract by its tag before the portal has stored the subscription id', async () => {
    await handleEvent(
      event('customer.subscription.created', {
        id: 'sub_new',
        customer: 'cus_1',
        status: 'active',
        metadata: { contractId: 'contract-1' },
      }),
    )

    expect(prisma.contract.findFirst.mock.calls[0]?.[0].where).toEqual({ id: 'contract-1' })
    expect(prisma.contract.update.mock.calls[0]?.[0].data).toMatchObject({
      stripeSubscriptionId: 'sub_new',
      status: 'active',
    })
  })

  it('reads paused collection as a paused contract, though Stripe still says active', async () => {
    await handleEvent(
      event('customer.subscription.updated', {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        pause_collection: { behavior: 'void' },
      }),
    )

    expect(prisma.contract.update.mock.calls[0]?.[0].data).toMatchObject({ status: 'paused' })
  })

  it('keeps a completed contract completed when its last period runs out', async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: 'contract-1', status: 'completed' })

    await handleEvent(
      event('customer.subscription.deleted', {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'canceled',
      }),
    )

    expect(prisma.contract.update.mock.calls[0]?.[0].data.status).toBeUndefined()
  })

  it('ignores a subscription this portal has no contract for', async () => {
    prisma.contract.findFirst.mockResolvedValue(null)

    expect(
      await handleEvent(
        event('customer.subscription.updated', {
          id: 'sub_other',
          customer: 'cus_other',
          status: 'active',
        }),
      ),
    ).toBe('handled')
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })
})
