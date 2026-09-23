import type { EventName } from '@/lib/analytics'

export const authEvents = {
  impersonationStarted: 'auth.impersonation.started',
  impersonationFailed: 'auth.impersonation.failed',
  impersonationStopped: 'auth.impersonation.stopped',
  impersonationStopFailed: 'auth.impersonation.stop_failed',
} as const satisfies Record<string, EventName>
