// No analytics vendor is wired yet, so every event funnels through here and the vendor stays swappable.
export type EventName = `${string}.${string}.${string}`

export type EventProperties = Record<string, string | number | boolean | null>

// Never pass PII: ids and reasons only, per .claude/rules/frontend-patterns.md.
export function track(event: EventName, properties: EventProperties = {}) {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[track] ${event}`, properties)
  }
}
