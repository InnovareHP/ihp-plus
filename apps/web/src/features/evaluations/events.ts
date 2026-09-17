import type { EventName } from '@/lib/analytics'

export const evaluationEvents = {
  assignStarted: 'evaluations.evaluation.assign_started',
  assigned: 'evaluations.evaluation.assigned',
  assignFailed: 'evaluations.evaluation.assign_failed',
  started: 'evaluations.evaluation.started',
  submitted: 'evaluations.evaluation.submitted',
  submitFailed: 'evaluations.evaluation.submit_failed',
  cancelled: 'evaluations.evaluation.cancelled',
  cancelFailed: 'evaluations.evaluation.cancel_failed',
} as const satisfies Record<string, EventName>
