import { DIGEST_TOPICS, type DigestTopic } from '../schema'

/** The Monday after a local date, never the same day, so a Monday draft still gets a review window. */
export function nextSendOn(todayKey: string): string {
  const today = new Date(`${todayKey}T00:00:00.000Z`)
  const ahead = (8 - today.getUTCDay()) % 7 || 7
  today.setUTCDate(today.getUTCDate() + ahead)
  return today.toISOString().slice(0, 10)
}

/** Round-robin through the switched-on topics in the app's order, after the last issue's. */
export function nextTopic(
  lastTopic: string | undefined,
  enabled: readonly DigestTopic[] = DIGEST_TOPICS,
): DigestTopic {
  const order = DIGEST_TOPICS.filter((topic) => enabled.includes(topic))
  if (order.length === 0) return 'phishing'
  const last = DIGEST_TOPICS.indexOf(lastTopic as DigestTopic)
  // The first switched-on topic that comes after the last one, wrapping round.
  return order.find((topic) => DIGEST_TOPICS.indexOf(topic) > last) ?? order[0] ?? 'phishing'
}

/** Typed addresses first, then client contacts, each once regardless of case. */
export function recipientsOf(typed: readonly string[], clientEmails: readonly string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...typed, ...clientEmails]) {
    const email = raw.trim()
    const key = email.toLowerCase()
    if (!email || seen.has(key)) continue
    seen.add(key)
    out.push(email)
  }
  return out
}
