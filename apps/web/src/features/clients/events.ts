import type { EventName } from '@/lib/analytics'

export const clientEvents = {
  created: 'clients.client.created',
  createFailed: 'clients.client.create_failed',
  updated: 'clients.client.updated',
  updateFailed: 'clients.client.update_failed',
  archived: 'clients.client.archived',
  archiveFailed: 'clients.client.archive_failed',
  restored: 'clients.client.restored',
  restoreFailed: 'clients.client.restore_failed',
  optionsAdded: 'clients.option.bulk_added',
  optionsAddFailed: 'clients.option.bulk_add_failed',
  optionRetired: 'clients.option.retired',
  optionRetireFailed: 'clients.option.retire_failed',
} as const satisfies Record<string, EventName>
