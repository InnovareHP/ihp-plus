/**
 * The Stripe events this portal acts on. Anything else is stored and acknowledged rather than
 * handled: an endpoint that 400s on an event it does not know makes Stripe retry for days and
 * eventually disable the endpoint.
 */
export const HANDLED_EVENTS = [
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.finalized',
  'invoice.voided',
  'invoice.marked_uncollectible',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
] as const

export type HandledEvent = (typeof HANDLED_EVENTS)[number]

export function isHandledEvent(type: string): type is HandledEvent {
  return (HANDLED_EVENTS as readonly string[]).includes(type)
}

/**
 * Stripe's subscription statuses mapped onto the contract statuses the portal already has
 * (`contracts.prisma`). Only a status the portal owns a word for is mapped: `past_due` and
 * `unpaid` deliberately leave the contract alone, because a late invoice is a billing fact
 * rather than a change to what was agreed — the failure shows on the invoice instead.
 */
export const CONTRACT_STATUS_BY_SUBSCRIPTION: Record<string, string | undefined> = {
  active: 'active',
  trialing: 'active',
  paused: 'paused',
  canceled: 'cancelled',
  incomplete_expired: 'cancelled',
}

export function contractStatusFor(subscriptionStatus: string) {
  return CONTRACT_STATUS_BY_SUBSCRIPTION[subscriptionStatus]
}

/** Stripe sends seconds; every timestamp in this database is a Date. */
export function dateFrom(seconds: number | null | undefined) {
  return typeof seconds === 'number' ? new Date(seconds * 1000) : null
}
