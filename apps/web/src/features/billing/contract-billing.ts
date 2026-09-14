import { db } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { lineTotalCents, type ContractStatus } from '@/features/contracts/schema'
import { isStripeConfigured, stripe } from '@/lib/stripe'
import {
  BILLING_CURRENCY,
  BillingPlanError,
  DAYS_UNTIL_DUE,
  planBilling,
  type BillableContract,
  type BillableLine,
} from './invoice-plan'

export interface BillableContractRecord extends BillableContract {
  organizationId: string
  clientId: string
  status: string
  /** Part of every idempotency key, so a retry reuses Stripe objects and an edited contract does not. */
  updatedAt: Date
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

/** The Stripe ids a contract points at once billing is attached. */
export interface BillingAttachment {
  stripeCustomerId: string
  stripeSubscriptionId: string | null
}

/**
 * Carries a status change into Stripe before the portal records it, so a Stripe failure leaves
 * the contract exactly as it was. Returns the ids to store when the change started billing.
 */
export async function syncBilling(
  contract: BillableContractRecord,
  to: ContractStatus,
  now = new Date(),
): Promise<BillingAttachment | null> {
  // A portal with no Stripe keys still agrees contracts; they just stay unbilled.
  if (!isStripeConfigured()) return null

  try {
    if (to === 'active' && contract.status === 'sent') return await startBilling(contract, now)
    if (contract.stripeSubscriptionId) {
      await changeSubscription(contract.stripeSubscriptionId, contract.status, to)
    }
    return null
  } catch (error) {
    throw billingErrorOf(error, contract.reference)
  }
}

async function startBilling(
  contract: BillableContractRecord,
  now: Date,
): Promise<BillingAttachment> {
  const plan = planBilling(contract, now)
  const customer = await customerFor(contract)
  const key = `contract-${contract.id}-${contract.updatedAt.getTime()}`
  const metadata = {
    contractId: contract.id,
    reference: contract.reference,
    organizationId: contract.organizationId,
  }

  if (plan.kind === 'invoice') {
    const invoice = await stripe.invoices.create(
      {
        customer,
        collection_method: 'send_invoice',
        days_until_due: DAYS_UNTIL_DUE,
        pending_invoice_items_behavior: 'exclude',
        description: `${contract.reference} · ${contract.title}`,
        metadata,
      },
      { idempotencyKey: `${key}-invoice` },
    )
    if (!invoice.id) throw new Error('Stripe returned an invoice without an id.')

    // Sequential, because an invoice lists its items in the order they were created.
    for (const line of plan.lines) {
      await stripe.invoiceItems.create(
        {
          customer,
          invoice: invoice.id,
          currency: BILLING_CURRENCY,
          amount: lineTotalCents(line),
          description: line.quantity > 1 ? `${line.name} × ${line.quantity}` : line.name,
          metadata: { contractId: contract.id, lineId: line.id },
        },
        { idempotencyKey: `${key}-item-${line.id}` },
      )
    }

    await stripe.invoices.finalizeInvoice(invoice.id, {}, { idempotencyKey: `${key}-finalize` })
    await stripe.invoices.sendInvoice(invoice.id, {}, { idempotencyKey: `${key}-send` })
    return { stripeCustomerId: customer, stripeSubscriptionId: null }
  }

  // A price needs a product, and one per line keeps each service named on the client's invoice.
  const productFor = async (line: BillableLine) => {
    const product = await stripe.products.create(
      {
        name: line.name,
        ...(line.description ? { description: line.description } : {}),
        metadata: { contractId: contract.id, lineId: line.id },
      },
      { idempotencyKey: `${key}-product-${line.id}` },
    )
    return product.id
  }

  const [items, setupFees] = await Promise.all([
    Promise.all(
      plan.recurring.map(async (line) => ({
        price_data: {
          currency: BILLING_CURRENCY,
          product: await productFor(line),
          unit_amount: line.unitPriceCents,
          recurring: { interval: 'month' as const },
        },
        quantity: line.quantity,
        metadata: { lineId: line.id },
      })),
    ),
    Promise.all(
      plan.oneOff.map(async (line) => ({
        price_data: {
          currency: BILLING_CURRENCY,
          product: await productFor(line),
          unit_amount: line.unitPriceCents,
        },
        quantity: line.quantity,
        metadata: { lineId: line.id },
      })),
    ),
  ])

  const subscription = await stripe.subscriptions.create(
    {
      customer,
      collection_method: 'send_invoice',
      days_until_due: DAYS_UNTIL_DUE,
      items,
      ...(setupFees.length > 0 ? { add_invoice_items: setupFees } : {}),
      // Nothing is charged for the gap before a future start; the first invoice lands on it.
      ...(plan.anchor ? { billing_cycle_anchor: plan.anchor, proration_behavior: 'none' } : {}),
      ...(plan.cancelAt ? { cancel_at: plan.cancelAt } : {}),
      metadata,
    },
    { idempotencyKey: `${key}-subscription` },
  )

  return { stripeCustomerId: customer, stripeSubscriptionId: subscription.id }
}

async function customerFor(contract: BillableContractRecord) {
  if (contract.stripeCustomerId) return contract.stripeCustomerId

  // One Stripe customer per client, so every contract with them shares one billing history.
  const earlier = await db.contract.findFirst({
    where: {
      clientId: contract.clientId,
      organizationId: contract.organizationId,
      stripeCustomerId: { not: null },
    },
    select: { stripeCustomerId: true },
  })
  if (earlier?.stripeCustomerId) return earlier.stripeCustomerId

  const client = await db.client.findFirst({
    where: { id: contract.clientId, organizationId: contract.organizationId },
    select: { id: true, name: true, email: true, updatedAt: true },
  })
  if (!client) throw new ConnectError('That client no longer exists.', Code.NotFound)
  if (!client.email) {
    throw new BillingPlanError(
      `Add a billing email for ${client.name} first. Stripe sends the invoice there.`,
    )
  }

  const customer = await stripe.customers.create(
    {
      name: client.name,
      email: client.email,
      metadata: { clientId: client.id, organizationId: contract.organizationId },
    },
    { idempotencyKey: `client-${client.id}-${client.updatedAt.getTime()}` },
  )
  return customer.id
}

async function changeSubscription(subscriptionId: string, from: string, to: ContractStatus) {
  if (to === 'paused') {
    // Void rather than defer: a paused retainer owes nothing for the time it was paused.
    await stripe.subscriptions.update(subscriptionId, { pause_collection: { behavior: 'void' } })
  } else if (to === 'active' && from === 'paused') {
    await stripe.subscriptions.update(subscriptionId, { pause_collection: '' })
  } else if (to === 'completed') {
    // The period already invoiced was work delivered, so it runs out instead of being refunded.
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
  } else if (to === 'cancelled') {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (subscription.status !== 'canceled') await stripe.subscriptions.cancel(subscriptionId)
  }
}

function isStripeError(error: unknown): error is Error {
  const type = error instanceof Error ? (error as { type?: unknown }).type : undefined
  return typeof type === 'string' && type.startsWith('Stripe')
}

function billingErrorOf(error: unknown, reference: string) {
  if (error instanceof ConnectError) return error
  if (error instanceof BillingPlanError)
    return new ConnectError(error.message, Code.FailedPrecondition)

  console.error(`[stripe] billing for ${reference} failed`, error)
  // Stripe's wording is written for whoever fixes the account, unlike an internal error's.
  const detail = isStripeError(error) ? ` Stripe said: ${error.message}` : ''
  return new ConnectError(
    `Could not update billing for ${reference}, so the contract was left as it was.${detail} Try again.`,
    Code.Unavailable,
  )
}
