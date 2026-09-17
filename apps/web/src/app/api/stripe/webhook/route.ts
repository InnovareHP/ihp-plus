import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { claimEvent, handleEvent, markFailed, markProcessed } from '@/features/billing/service'
import { isStripeConfigured, stripe } from '@/lib/stripe'

// Signature verification needs node crypto, and the body must never be cached or parsed.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Stripe's webhook endpoint: POST /app/api/stripe/webhook.
 *
 * The status code is the whole protocol. A 2xx means "delivered, stop retrying"; anything else
 * makes Stripe redeliver with backoff for up to three days and eventually disable the endpoint.
 * So a signature failure or an event we do not handle answers 2xx-or-400 deliberately, and only
 * a genuine fault on our side answers 500.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    // 500 rather than 200: the events are real and should keep being retried until someone
    // sets the keys, not be silently dropped.
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
  }

  // The raw body, byte for byte: parsing it first would change the bytes the signature covers.
  const body = await request.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? '',
    )
  } catch (error) {
    // 400, not 500: a bad signature is never worth retrying, and it is the one case where the
    // request may not be from Stripe at all.
    const message = error instanceof Error ? error.message : 'Invalid signature.'
    console.warn(`[stripe] rejected a webhook: ${message}`)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  const { alreadyProcessed } = await claimEvent(event)
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, status: 'duplicate' })
  }

  try {
    const outcome = await handleEvent(event)
    await markProcessed(event.id)
    return NextResponse.json({ received: true, status: outcome })
  } catch (error) {
    await markFailed(event.id, error)
    console.error(`[stripe] ${event.type} (${event.id}) failed`, error)
    // 500 so Stripe retries: the event was ours to handle and we did not.
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 })
  }
}
