'use client'

import { Modal } from '@mantine/core'
import type { LibraryEntry } from '../schema'
import { ItemNameForm } from './item-name-form'

export interface RenameItemModalProps {
  entry: LibraryEntry | null
  onClose: () => void
  onRename: (name: string) => Promise<void>
}

export function RenameItemModal({ entry, onClose, onRename }: RenameItemModalProps) {
  return (
    <Modal
      opened={entry !== null}
      onClose={onClose}
      title={entry ? `Rename ${entry.name}` : 'Rename'}
      centered
      closeButtonProps={{ 'aria-label': 'Close rename' }}
    >
      {entry ? (
        <ItemNameForm
          // Remounts per item so the field starts from the name being changed.
          key={entry.id}
          label={entry.isFolder ? 'Folder name' : 'File name'}
          description="The client's copy is renamed to match."
          placeholder={entry.isFolder ? 'Onboarding packets' : 'Signed agreement.pdf'}
          submitLabel="Save name"
          pendingLabel="Saving…"
          errorTitle="Could not rename it"
          defaultName={entry.name}
          onSubmit={async (name) => {
            await onRename(name)
            onClose()
          }}
        />
      ) : null}
    </Modal>
  )
}
