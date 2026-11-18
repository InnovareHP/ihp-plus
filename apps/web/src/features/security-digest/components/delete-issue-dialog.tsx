'use client'

import { Button, Modal, Stack, Text } from '@mantine/core'
import { DialogActions } from '@/components/dialog-actions'

export interface DeleteIssueDialogProps {
  opened: boolean
  title: string
  pending: boolean
  onClose: () => void
  onConfirm: () => void
}

/** Deleting drops the issue and its log for good, so this asks first. */
export function DeleteIssueDialog({
  opened,
  title,
  pending,
  onClose,
  onConfirm,
}: DeleteIssueDialogProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Delete this issue?" centered>
      <Stack gap="md">
        <Text>“{title || 'This failed draft'}” is removed for good. Nothing is emailed.</Text>
        <DialogActions>
          <Button variant="default" onClick={onClose}>
            Keep it
          </Button>
          <Button color="red" onClick={onConfirm} loading={pending}>
            Delete issue
          </Button>
        </DialogActions>
      </Stack>
    </Modal>
  )
}
