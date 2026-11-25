import type { EventName } from '@/lib/analytics'

export const analyticsEvents = {
  reportLoaded: 'websites.analytics.loaded',
  reportFailed: 'websites.analytics.load_failed',
} as const satisfies Record<string, EventName>
