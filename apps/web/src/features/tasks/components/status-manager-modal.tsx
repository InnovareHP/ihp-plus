'use client'

import { ActionIcon, Box, Button, Group, Modal, Paper, Stack, Text } from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import {
  useCreateStatus,
  useDeleteStatus,
  useReorderStatus,
  useUpdateStatus,
} from '../hooks/use-task-projects'
import type { TaskRow, TaskStatusRow } from '../schema'
import { DeleteStatusModal } from './delete-status-modal'
import { StatusFormModal } from './status-form-modal'

export interface StatusManagerModalProps {
  opened: boolean
  statuses: readonly TaskStatusRow[]
  /** The board's rows, so the delete dialog can say how much work a column holds. */
  tasks: readonly TaskRow[]
  onClose: () => void
}

const CATEGORY_NOTES: Record<TaskStatusRow['category'], string> = {
  active: 'Open work',
  done: 'Closes the task',
  cancelled: 'Retires the task',
}

/** Columns belong to the organization, so a change here lands on every project's board. */
export function StatusManagerModal({ opened, statuses, tasks, onClose }: StatusManagerModalProps) {
  const [editing, setEditing] = useState<TaskStatusRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<TaskStatusRow | null>(null)

  const create = useCreateStatus()
  const update = useUpdateStatus()
  const reorder = useReorderStatus()
  const remove = useDeleteStatus()

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        centered
        size="lg"
        title="Columns"
        closeButtonProps={{ 'aria-label': 'Close columns' }}
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Every project on this board uses these columns. Renaming one keeps the work in it.
          </Text>

          <Stack component="ul" gap="xs" p={0} style={{ listStyle: 'none' }}>
            {statuses.map((status, index) => (
              <Paper key={status.id} component="li" withBorder radius="md" p="sm">
                <Group justify="space-between" wrap="nowrap" gap="sm">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Box
                      w={12}
                      h={12}
                      style={{ background: status.color, borderRadius: 999 }}
                      aria-hidden
                    />
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500}>
                        {status.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {CATEGORY_NOTES[status.category]} ·{' '}
                        {tasks.filter((task) => task.statusId === status.id).length} here
                      </Text>
                    </Stack>
                  </Group>

                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      aria-label={`Move ${status.name} left`}
                      disabled={index === 0 || reorder.isPending}
                      onClick={() =>
                        reorder.mutate({
                          statusId: status.id,
                          beforeStatusId: statuses[index - 1]?.id,
                        })
                      }
                    >
                      <IconArrowUp size={16} aria-hidden />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      aria-label={`Move ${status.name} right`}
                      disabled={index === statuses.length - 1 || reorder.isPending}
                      onClick={() =>
                        reorder.mutate({
                          statusId: status.id,
                          beforeStatusId: statuses[index + 2]?.id,
                        })
                      }
                    >
                      <IconArrowDown size={16} aria-hidden />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      aria-label={`Rename ${status.name}`}
                      onClick={() => setEditing(status)}
                    >
                      <IconPencil size={16} aria-hidden />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Delete ${status.name}`}
                      onClick={() => setDeleting(status)}
                    >
                      <IconTrash size={16} aria-hidden />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>

          <Group justify="space-between">
            <Button
              variant="default"
              leftSection={<IconPlus size={16} aria-hidden />}
              onClick={() => setAdding(true)}
            >
              Add column
            </Button>
            <Button onClick={onClose}>Done</Button>
          </Group>
        </Stack>
      </Modal>

      <StatusFormModal
        opened={adding || editing !== null}
        status={editing}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
        onSave={async (values) => {
          if (editing) {
            await update.mutateAsync({
              statusId: editing.id,
              name: values.name,
              color: values.color,
            })
            return
          }
          await create.mutateAsync(values)
        }}
      />

      <DeleteStatusModal
        status={deleting}
        statuses={statuses}
        tasks={tasks}
        onCancel={() => setDeleting(null)}
        onConfirm={(status, moveToStatusId) => {
          remove.mutate({ statusId: status.id, moveToStatusId })
          setDeleting(null)
        }}
      />
    </>
  )
}
