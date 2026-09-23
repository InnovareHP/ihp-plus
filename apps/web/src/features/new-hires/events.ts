import type { EventName } from '@/lib/analytics'

export const newHireEvents = {
  taskCompleted: 'new_hires.task.completed',
  taskReopened: 'new_hires.task.reopened',
  taskToggleFailed: 'new_hires.task.toggle_failed',
  checklistClosed: 'new_hires.checklist.closed',
  checklistCloseFailed: 'new_hires.checklist.close_failed',
  documentRequired: 'new_hires.document.required',
  documentRequireFailed: 'new_hires.document.require_failed',
  documentUnrequired: 'new_hires.document.unrequired',
  documentUnrequireFailed: 'new_hires.document.unrequire_failed',
  setupTaskAdded: 'new_hires.setup_task.added',
  setupTaskAddFailed: 'new_hires.setup_task.add_failed',
  setupTaskRemoved: 'new_hires.setup_task.removed',
  setupTaskRemoveFailed: 'new_hires.setup_task.remove_failed',
} as const satisfies Record<string, EventName>
