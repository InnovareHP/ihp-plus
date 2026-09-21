'use client'

import { Button, Group, Paper, Text } from '@mantine/core'
import { IconCheck, IconTrash, IconX } from '@tabler/icons-react'

export interface TaskSelectionBarProps {
  count: number
  isBusy: boolean
  onComplete: () => void
  onDelete: () => void
  onClear: () => void
}

/** Sticks to the bottom while a selection stands, with the way out next to the actions. */
export function TaskSelectionBar({
  count,
  isBusy,
  onComplete,
  onDelete,
  onClear,
}: TaskSelectionBarProps) {
  if (count === 0) return null

  return (
    <Paper
      withBorder
      radius="md"
      p="sm"
      pos="sticky"
      bottom={0}
      style={{ zIndex: 2, backgroundColor: 'var(--mantine-color-body)' }}
      // Announced as it appears: the bar is the only sign the selection exists.
      role="region"
      aria-label={`${count} selected`}
    >
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm" fw={500}>
          {count === 1 ? '1 task selected' : `${count} tasks selected`}
        </Text>

        <Group gap="xs" wrap="wrap">
          <Button
            size="sm"
            variant="default"
            leftSection={<IconCheck size={16} aria-hidden />}
            disabled={isBusy}
            onClick={onComplete}
          >
            Mark done
          </Button>
          <Button
            size="sm"
            color="red"
            variant="light"
            leftSection={<IconTrash size={16} aria-hidden />}
            disabled={isBusy}
            onClick={onDelete}
          >
            Delete
          </Button>
          <Button
            size="sm"
            variant="subtle"
            leftSection={<IconX size={16} aria-hidden />}
            onClick={onClear}
          >
            Clear selection
          </Button>
        </Group>
      </Group>
    </Paper>
  )
}
