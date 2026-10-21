'use client'

import { Modal } from '@mantine/core'
import {
  EMPTY_CLIENT_DRAFT,
  type ClientDraftValues,
  type ClientLookupKind,
  type ClientOptionMap,
} from '../schema'
import { ClientForm } from './client-form'

export interface ClientFormModalProps {
  opened: boolean
  onClose: () => void
  title: string
  submitLabel: string
  owners: { value: string; label: string }[]
  options: ClientOptionMap
  onManageOptions: (kind: ClientLookupKind) => void
  /** The record being edited; keys the form so a different client starts fresh. */
  clientId?: string
  defaults?: ClientDraftValues
  onSave: (values: ClientDraftValues) => Promise<void>
}

export function ClientFormModal({
  opened,
  onClose,
  title,
  submitLabel,
  owners,
  options,
  onManageOptions,
  clientId,
  defaults,
  onSave,
}: ClientFormModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size="lg"
      closeButtonProps={{ 'aria-label': `Close ${title.toLowerCase()}` }}
    >
      {/* Keyed on the record so opening a different client resets the fields without an effect. */}
      <ClientForm
        key={clientId ?? 'new'}
        submitLabel={submitLabel}
        owners={owners}
        options={options}
        onManageOptions={onManageOptions}
        defaults={defaults ?? EMPTY_CLIENT_DRAFT}
        onSave={onSave}
        onClose={onClose}
      />
    </Modal>
  )
}
