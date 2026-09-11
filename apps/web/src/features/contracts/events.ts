import type { EventName } from '@/lib/analytics'

export const contractEvents = {
  created: 'contracts.contract.created',
  createFailed: 'contracts.contract.create_failed',
  statusChanged: 'contracts.contract.status_changed',
  statusChangeFailed: 'contracts.contract.status_change_failed',
  catalogItemAdded: 'contracts.catalog_item.added',
  catalogItemAddFailed: 'contracts.catalog_item.add_failed',
  templateSaved: 'contracts.template.saved',
  templateSaveFailed: 'contracts.template.save_failed',
} as const satisfies Record<string, EventName>
