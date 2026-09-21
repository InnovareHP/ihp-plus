'use client'

import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import type { TaskListRow } from '../schema'

export interface DeleteListModalProps {
  list: TaskListRow | null
  /** A list holding work is refused by the server; saying so here saves the round trip. */
  taskCount: number
  onCancel: () => void
  onConfirm: (list: TaskListRow) => void
}

export function DeleteListModal({ list, taskCount, onCancel, onConfirm }: DeleteListModalProps) {
  const holdsWork = taskCount > 0

  return (
    <Modal
      opened={Boolean(list)}
      onClose={onCancel}
      centered
      title="Delete list"
      closeButtonProps={{ 'aria-label': 'Close delete list' }}
    >
      <Stack gap="md">
        <Text size="sm">
          {list
            ? holdsWork
              ? `"${list.name}" still holds ${taskCount === 1 ? '1 task' : `${taskCount} tasks`}. Move or delete them first.`
              : `"${list.name}" is removed for everyone. This cannot be undone.`
            : null}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Keep list
          </Button>
          <Button
            color="red"
            data-autofocus
            disabled={holdsWork}
            onClick={() => list && onConfirm(list)}
          >
            Delete list
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
