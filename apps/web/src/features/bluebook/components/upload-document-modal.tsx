'use client'

import { Modal } from '@mantine/core'
import type { DocumentDraftInput, DocumentDraftValues, ShelfOption } from '../schema'
import { DocumentForm } from './document-form'

export interface UploadDocumentModalProps {
  opened: boolean
  onClose: () => void
  /** Only the shelves this person may file on; the picker never offers a refusal. */
  shelves: ShelfOption[]
  categories: string[]
  canManageCategories: boolean
  onManageCategories: () => void
  defaults?: DocumentDraftInput
  /** Absent for an edit: metadata changes never replace the stored file. */
  onUpload?: (values: DocumentDraftValues, file: File) => Promise<void>
  onSave?: (values: DocumentDraftValues) => Promise<void>
  title: string
  submitLabel: string
}

export function UploadDocumentModal(props: UploadDocumentModalProps) {
  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={props.title}
      centered
      size="lg"
      closeButtonProps={{ 'aria-label': `Close ${props.title.toLowerCase()}` }}
    >
      {/* Keyed on the record so opening a different document resets the fields without an effect. */}
      <DocumentForm key={props.defaults?.title ?? 'new'} {...props} />
    </Modal>
  )
}
