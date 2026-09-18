'use client'

import { Modal } from '@mantine/core'
import { ItemNameForm } from './item-name-form'

export interface NewFolderModalProps {
  opened: boolean
  onClose: () => void
  /** Where the folder is created, for copy that says so. */
  folderLabel: string
  onCreate: (name: string) => Promise<void>
}

export function NewFolderModal({ opened, onClose, folderLabel, onCreate }: NewFolderModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="New folder"
      centered
      closeButtonProps={{ 'aria-label': 'Close new folder' }}
    >
      <ItemNameForm
        label="Folder name"
        description={`It is created in ${folderLabel}.`}
        placeholder="Onboarding packets"
        submitLabel="Create folder"
        pendingLabel="Creating…"
        errorTitle="Could not create the folder"
        onSubmit={async (name) => {
          await onCreate(name)
          onClose()
        }}
      />
    </Modal>
  )
}
