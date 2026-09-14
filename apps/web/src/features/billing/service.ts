import { db } from '@ihp/db'
import type Stripe from 'stripe'
import { contractStatusFor, dateFrom, isHandledEvent } from './schema'

/**
 * What the endpoint should do with the response. A retry means Stripe will deliver again, so
 * it is reserved for a fault on our side — a handler that returns `retry` for bad data would
 * have Stripe redeliver it for days.
 */
export type EventOutcome = 'handled' | 'ignored' | 'duplicate'

/**
 * Records the event and returns whether it is new. Stripe delivers at least once and retries
 * a non-2xx for days, so the same event arrives more than once as a matter of course; the
 * primary key on Stripe's own event id is what makes handling it idempotent.
 */
export async function claimEvent(event: Stripe.Event) {
  const existing = await db.stripeEvent.findUnique({
    where: { id: event.id },
    select: { processedAt: true },
  })

  if (existing?.processedAt) return { alreadyProcessed: true }

  await db.stripeEvent.upsert({
    where: { id: event.id },
    // A retry of something that failed: count the attempt and let the handler run again.
    update: { attempts: { increment: 1 } },
    create: {
      id: event.id,
      type: event.type,
      attempts: 1,
      payload: event as unknown as object,
    },
  })

  return { alreadyProcessed: false }
}

export async function markProcessed(eventId: string) {
  await db.stripeEvent.update({
    where: { id: eventId },
    data: { processedAt: new Date(), failedAt: null, error: null },
  })
}

export async function markFailed(eventId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  await db.stripeEvent.update({
    where: { id: eventId },
    data: { failedAt: new Date(), error: message.slice(0, 500) },
  })
}

/** Dispatches one verified event. Unknown types are acknowledged, never retried. */
export async function handleEvent(event: Stripe.Event): Promise<EventOutcome> {
  if (!isHandledEvent(event.type)) return 'ignored'

  if (event.type.startsWith('invoice.')) {
    await recordInvoice(event.data.object as Stripe.Invoice)
    return 'handled'
  }

  await applySubscription(event.data.object as Stripe.Subscription)
  return 'handled'
}

function idOf(value: string | { id: string } | null | undefined) {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

// Stripe has moved the subscription an invoice belongs to between API versions.
type InvoiceParent = {
  subscription_details?: { subscription?: unknown; metadata?: Record<string, string> | null }
} | null

/**
 * Mirrors one invoice. Written from the event rather than re-fetched: the payload is already
 * signed, and a fetch would race a newer state onto an older event.
 */
async function recordInvoice(invoice: Stripe.Invoice) {
  const customerId = idOf(invoice.customer)
  // An invoice with no customer is not something this portal bills against.
  if (!invoice.id || !customerId) return

  const subscriptionId = subscriptionIdOf(invoice)
  const paid = invoice.status === 'paid'
  const failed = invoice.status === 'open' && (invoice.attempt_count ?? 0) > 0

  const fields = {
    customerId,
    subscriptionId,
    contractId: await contractIdFor(invoice, subscriptionId),
    status: invoice.status ?? 'draft',
    amountDueCents: invoice.amount_due,
    amountPaidCents: invoice.amount_paid,
    currency: invoice.currency,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    paidAt: paid ? (dateFrom(invoice.status_transitions?.paid_at) ?? new Date()) : null,
    failedAt: failed ? new Date() : null,
    failureReason: failed ? (failureReasonOf(invoice) ?? 'The payment was declined.') : null,
    periodStart: dateFrom(invoice.period_start),
    periodEnd: dateFrom(invoice.period_end),
  }

  await db.stripeInvoice.upsert({
    where: { id: invoice.id },
    update: fields,
    create: { id: invoice.id, ...fields },
  })
}

function subscriptionIdOf(invoice: Stripe.Invoice) {
  const fromParent = (invoice.parent as InvoiceParent)?.subscription_details?.subscription
  if (fromParent) return idOf(fromParent as string | { id: string })

  const legacy = (invoice as unknown as { subscription?: string | { id: string } }).subscription
  return idOf(legacy)
}

function failureReasonOf(invoice: Stripe.Invoice) {
  const intent = (invoice as unknown as { payment_intent?: Stripe.PaymentIntent | string })
    .payment_intent
  if (!intent || typeof intent === 'string') return undefined
  return intent.last_payment_error?.message
}

/**
 * The contract an invoice bills. The portal tags what it creates with the contract id, and a
 * customer alone never decides it: one client can hold several contracts on the same customer.
 */
async function contractIdFor(invoice: Stripe.Invoice, subscriptionId: string | null) {
  const tagged =
    invoice.metadata?.contractId ??
    (invoice.parent as InvoiceParent)?.subscription_details?.metadata?.contractId

  const where = tagged
    ? { id: tagged }
    : subscriptionId
      ? { stripeSubscriptionId: subscriptionId }
      : null
  if (!where) return null

  const contract = await db.contract.findFirst({ where, select: { id: true } })
  return contract?.id ?? null
}

/**
 * Applies a subscription's lifecycle to the contract it bills. A subscription the portal has
 * no contract for is ignored rather than treated as an error: Stripe accounts hold objects
 * this portal never created.
 */
async function applySubscription(subscription: Stripe.Subscription) {
  const customerId = idOf(subscription.customer)
  if (!customerId) return

  // The tag is read first because the created event can arrive before the portal stores the id.
  const contractId = subscription.metadata?.contractId
  const contract = await db.contract.findFirst({
    where: contractId ? { id: contractId } : { stripeSubscriptionId: subscription.id },
    select: { id: true, status: true },
  })
  if (!contract) return

  // Paused collection leaves Stripe's status at active, so it is what marks the contract paused.
  const status = subscription.pause_collection ? 'paused' : contractStatusFor(subscription.status)
  // A completed contract's last period running out must not read as a cancellation.
  const settled = contract.status === 'cancelled' || contract.status === 'completed'

  await db.contract.update({
    where: { id: contract.id },
    data: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      // Left alone for past_due and unpaid: a late invoice does not change what was agreed.
      ...(status && !settled ? { status } : {}),
    },
  })
}
