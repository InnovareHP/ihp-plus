'use client'

import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import type { TaskRow } from '../schema'

export interface DeleteTaskModalProps {
  task: TaskRow | null
  onCancel: () => void
  onConfirm: (task: TaskRow) => void
}

// Deleting a task cannot be undone, which is the one case this app asks before acting.
export function DeleteTaskModal({ task, onCancel, onConfirm }: DeleteTaskModalProps) {
  return (
    <Modal
      opened={Boolean(task)}
      onClose={onCancel}
      title="Delete task"
      centered
      closeButtonProps={{ 'aria-label': 'Close delete task' }}
    >
      <Stack gap="md">
        <Text size="sm">
          {task ? `"${task.name}" is removed for everyone. This cannot be undone.` : null}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Keep task
          </Button>
          <Button color="red" onClick={() => task && onConfirm(task)} data-autofocus>
            Delete task
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
