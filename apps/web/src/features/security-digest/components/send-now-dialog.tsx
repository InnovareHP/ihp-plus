'use client'

import { Button, Modal, Stack, Text } from '@mantine/core'
import { DialogActions } from '@/components/dialog-actions'

export interface SendNowDialogProps {
  opened: boolean
  title: string
  recipientCount: number
  isDraft: boolean
  pending: boolean
  onClose: () => void
  onConfirm: () => void
}

const people = (count: number) => `${count} ${count === 1 ? 'person' : 'people'}`

/** Email cannot be unsent, so this is one of the few places that asks first. */
export function SendNowDialog({
  opened,
  title,
  recipientCount,
  isDraft,
  pending,
  onClose,
  onConfirm,
}: SendNowDialogProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Send this issue now?" centered>
      <Stack gap="md">
        <Text>
          “{title}” goes to {people(recipientCount)} straight away instead of on its Monday.
          {isDraft ? ' Sending it also approves it in your name.' : ''}
        </Text>
        {recipientCount === 0 ? (
          <Text c="red.7" size="sm" role="alert">
            Nobody is on the list yet — add a recipient in Settings first.
          </Text>
        ) : null}
        <DialogActions>
          <Button variant="default" onClick={onClose}>
            Keep it scheduled
          </Button>
          <Button onClick={onConfirm} loading={pending} disabled={recipientCount === 0}>
            Send to {people(recipientCount)}
          </Button>
        </DialogActions>
      </Stack>
    </Modal>
  )
}
