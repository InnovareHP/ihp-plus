import type { EventName } from '@/lib/analytics'

export const leaveEvents = {
  allowanceSet: 'leave.allowance.set',
  allowanceCleared: 'leave.allowance.cleared',
  allowanceSetFailed: 'leave.allowance.set_failed',
} as const satisfies Record<string, EventName>
