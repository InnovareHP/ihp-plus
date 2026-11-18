import { DIGEST_TOPICS, type DigestTopic } from '../schema'

/** The Monday after a local date, never the same day, so a Monday draft still gets a review window. */
export function nextSendOn(todayKey: string): string {
  const today = new Date(`${todayKey}T00:00:00.000Z`)
  const ahead = (8 - today.getUTCDay()) % 7 || 7
  today.setUTCDate(today.getUTCDate() + ahead)
  return today.toISOString().slice(0, 10)
}

/** Round-robin from the last issue's topic, so four weeks cover all four. */
export function nextTopic(lastTopic: string | undefined): DigestTopic {
  const last = DIGEST_TOPICS.indexOf(lastTopic as DigestTopic)
  return DIGEST_TOPICS[(last + 1) % DIGEST_TOPICS.length] ?? 'phishing'
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
