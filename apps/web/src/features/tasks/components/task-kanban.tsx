'use client'

import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import type { TaskRow as Task, TaskStatusRow } from '../schema'
import { TaskCard } from './task-card'

export interface TaskKanbanProps {
  statuses: readonly TaskStatusRow[]
  tasks: readonly Task[]
  onOpen: (task: Task) => void
  onMoveTo: (task: Task, statusId: string) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

/**
 * Columns are the organization's statuses, so every project's board reads the same. Dragging is
 * an enhancement on top of the card's own "Move to" menu, which is the keyboard path.
 */
export function TaskKanban({
  statuses,
  tasks,
  onOpen,
  onMoveTo,
  onEdit,
  onDelete,
}: TaskKanbanProps) {
  const [dragging, setDragging] = useState<Task | null>(null)
  const [over, setOver] = useState<string | null>(null)

  function drop(statusId: string) {
    setOver(null)
    if (!dragging || dragging.statusId === statusId) return
    onMoveTo(dragging, statusId)
    setDragging(null)
  }

  return (
    // The board scrolls sideways in its own container so the page never does.
    <Box style={{ overflowX: 'auto' }} pb="sm">
      <Group align="flex-start" gap="md" wrap="nowrap">
        {statuses.map((status) => {
          const items = tasks.filter((task) => task.statusId === status.id)

          return (
            <Paper
              key={status.id}
              component="section"
              // A named region per column, so a screen reader can jump between them.
              aria-label={`${status.name}, ${items.length} tasks`}
              withBorder
              radius="md"
              p="sm"
              w={300}
              miw={300}
              bg={over === status.id ? 'var(--mantine-color-default-hover)' : undefined}
              onDragOver={(event) => {
                event.preventDefault()
                setOver(status.id)
              }}
              onDragLeave={() => setOver((current) => (current === status.id ? null : current))}
              onDrop={() => drop(status.id)}
            >
              <Stack gap="sm">
                <Group justify="space-between" align="baseline" wrap="nowrap">
                  <Group gap={8} align="center" wrap="nowrap">
                    <Box
                      w={10}
                      h={10}
                      style={{ background: status.color, borderRadius: 999 }}
                      aria-hidden
                    />
                    <Title order={3} size="h6">
                      {status.name}
                    </Title>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {items.length}
                  </Text>
                </Group>

                {items.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    Nothing here.
                  </Text>
                ) : (
                  <Stack
                    component="ul"
                    gap="xs"
                    style={{ listStyle: 'none', padding: 0, margin: 0 }}
                  >
                    {items.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        otherStatuses={statuses.filter((one) => one.id !== status.id)}
                        onOpen={onOpen}
                        onMoveTo={onMoveTo}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onDragStart={setDragging}
                      />
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>
          )
        })}
      </Group>
    </Box>
  )
}
