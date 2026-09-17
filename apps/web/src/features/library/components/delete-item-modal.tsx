'use client'

import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import type { LibraryEntry } from '../schema'

export interface DeleteItemModalProps {
  entry: LibraryEntry | null
  isPending: boolean
  onClose: () => void
  onDelete: () => void
}

/** Deletion reaches the client's copy too, which is not something an undo toast can carry. */
export function DeleteItemModal({ entry, isPending, onClose, onDelete }: DeleteItemModalProps) {
  const isFolder = entry?.isFolder ?? false

  return (
    <Modal
      opened={entry !== null}
      onClose={onClose}
      title={isFolder ? 'Delete folder' : 'Delete file'}
      centered
      closeButtonProps={{ 'aria-label': 'Close delete' }}
    >
      <Stack gap="md">
        <Text size="sm">
          <strong>{entry?.name}</strong> moves to the SharePoint recycle bin
          {isFolder ? ', with everything inside it' : ''}. The client&rsquo;s copy is withdrawn at
          the same time.
        </Text>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Keep it
          </Button>
          <Button color="red" loading={isPending} onClick={onDelete} data-autofocus>
            {isFolder ? 'Delete folder' : 'Delete file'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
