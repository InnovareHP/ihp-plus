import type { EventName } from '@/lib/analytics'

export const contractEvents = {
  created: 'contracts.contract.created',
  createFailed: 'contracts.contract.create_failed',
  updated: 'contracts.contract.updated',
  updateFailed: 'contracts.contract.update_failed',
  statusChanged: 'contracts.contract.status_changed',
  statusChangeFailed: 'contracts.contract.status_change_failed',
  catalogItemAdded: 'contracts.catalog_item.added',
  catalogItemAddFailed: 'contracts.catalog_item.add_failed',
  catalogItemEdited: 'contracts.catalog_item.edited',
  catalogItemEditFailed: 'contracts.catalog_item.edit_failed',
  catalogItemArchived: 'contracts.catalog_item.archived',
  catalogItemArchiveFailed: 'contracts.catalog_item.archive_failed',
  templateSaved: 'contracts.template.saved',
  templateSaveFailed: 'contracts.template.save_failed',
  clientLinkCopied: 'contracts.client_link.copied',
  clientAcceptStarted: 'contracts.contract.client_accept_started',
  clientAccepted: 'contracts.contract.client_accepted',
  clientAcceptFailed: 'contracts.contract.client_accept_failed',
} as const satisfies Record<string, EventName>
