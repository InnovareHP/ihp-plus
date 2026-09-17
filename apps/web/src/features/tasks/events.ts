import type { EventName } from '@/lib/analytics'

export const taskEvents = {
  createStarted: 'tasks.task.create_started',
  created: 'tasks.task.created',
  createFailed: 'tasks.task.create_failed',
  updated: 'tasks.task.updated',
  updateFailed: 'tasks.task.update_failed',
  completed: 'tasks.task.completed',
  completeFailed: 'tasks.task.complete_failed',
  reordered: 'tasks.task.reordered',
  reorderFailed: 'tasks.task.reorder_failed',
  deleted: 'tasks.task.deleted',
  deleteFailed: 'tasks.task.delete_failed',
  projectCreated: 'tasks.project.created',
  projectCreateFailed: 'tasks.project.create_failed',
  listCreated: 'tasks.list.created',
  listCreateFailed: 'tasks.list.create_failed',
} as const satisfies Record<string, EventName>
