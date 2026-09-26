import type { EventName } from '@/lib/analytics'

export const letterheadEvents = {
  applied: 'letterhead.file.applied',
  applyFailed: 'letterhead.file.apply_failed',
} as const satisfies Record<string, EventName>
