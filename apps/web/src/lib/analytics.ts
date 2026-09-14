import posthog from 'posthog-js'

// PostHog receives the events, but every call funnels through here so the vendor stays swappable.
export type EventName = `${string}.${string}.${string}`

export type EventProperties = Record<string, string | number | boolean | null>

// Never pass PII: ids and reasons only, per .claude/rules/frontend-patterns.md.
export function track(event: EventName, properties: EventProperties = {}) {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[track] ${event}`, properties)
  }

  // PostHog is initialised only in a browser with a key, so a server render sends nothing.
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.capture(event, properties)
  }
}
