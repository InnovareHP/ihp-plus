'use client'

import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { TaskRow, TaskStatusRow } from '../schema'

export interface DeleteStatusModalProps {
  status: TaskStatusRow | null
  statuses: readonly TaskStatusRow[]
  tasks: readonly TaskRow[]
  onCancel: () => void
  onConfirm: (status: TaskStatusRow, moveToStatusId: string | undefined) => void
}

// Deleting a column is irreversible and moves work, so it asks — and asks where the work goes.
export function DeleteStatusModal({
  status,
  statuses,
  tasks,
  onCancel,
  onConfirm,
}: DeleteStatusModalProps) {
  const others = statuses.filter((one) => one.id !== status?.id)
  const held = status ? tasks.filter((task) => task.statusId === status.id).length : 0
  const [moveTo, setMoveTo] = useState<string | null>(null)

  const target = moveTo ?? others[0]?.id ?? null

  return (
    <Modal
      opened={Boolean(status)}
      onClose={onCancel}
      centered
      title="Delete column"
      closeButtonProps={{ 'aria-label': 'Close delete column' }}
    >
      <Stack gap="md">
        <Text size="sm">
          {status
            ? held > 0
              ? `"${status.name}" holds ${held === 1 ? '1 task' : `${held} tasks`}. Pick where that work goes; the column itself cannot be brought back.`
              : `"${status.name}" is removed for everyone. This cannot be undone.`
            : null}
        </Text>

        {held > 0 ? (
          <Select
            label="Move its tasks to"
            data={others.map((one) => ({ value: one.id, label: one.name }))}
            value={target}
            onChange={setMoveTo}
            allowDeselect={false}
            required
            aria-required="true"
          />
        ) : null}

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Keep column
          </Button>
          <Button
            color="red"
            data-autofocus
            disabled={held > 0 && !target}
            onClick={() =>
              status && onConfirm(status, held > 0 ? (target ?? undefined) : undefined)
            }
          >
            Delete column
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
