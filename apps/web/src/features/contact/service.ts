import { contactEnquiryTemplate, sendEmail } from '@/lib/email'
import { consumeRateLimit } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/turnstile'
import { contactEnquirySchema } from './schema'

const ENQUIRY_LIMIT = { window: 10 * 60, max: 5 }

/** Checks and forwards one enquiry from the marketing site's contact form to the sales inbox. */
export async function submitEnquiry(input: unknown, ip: string) {
  const parsed = contactEnquirySchema.safeParse(input)
  if (!parsed.success) return { status: 400, error: 'Check the form fields and try again.' }

  const limit = await consumeRateLimit(`contact:${ip}`, ENQUIRY_LIMIT)
  if (!limit.allowed) {
    return { status: 429, error: 'Too many messages from your connection — try again later.' }
  }

  if (!(await verifyTurnstile(parsed.data['cf-turnstile-response'], ip))) {
    return { status: 403, error: 'The security check did not pass — reload the page and retry.' }
  }

  const inbox = process.env.CONTACT_INBOX
  if (!inbox) {
    console.error('[contact] CONTACT_INBOX is unset, so the enquiry was not sent')
    return { status: 502, error: 'Could not send your message — try again later.' }
  }

  const { name, email, phone, message } = parsed.data
  const sent = await sendEmail({
    to: inbox,
    ...contactEnquiryTemplate({ name, email, phone, message }),
  })
  // sendEmail never throws, so an unconfigured or failed send is caught here or the lead is lost.
  if (!sent.delivered) {
    return { status: 502, error: 'Could not send your message — try again later.' }
  }
  return { status: 200, error: null }
}
