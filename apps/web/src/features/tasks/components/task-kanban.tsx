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
  /** A drop carries both halves of the move: which column, and where in it. */
  onReorder: (task: Task, statusId: string, beforeTaskId: string | undefined) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

/**
 * A column is a status and a card keeps its list, so the row a card lands before is the next one
 * from its own list — ordering a column never shuffles a list the user cannot see.
 */
function beforeInList(items: readonly Task[], from: number, listId: string) {
  return items.slice(from).find((item) => item.listId === listId)?.id
}

export function TaskKanban({
  statuses,
  tasks,
  onOpen,
  onMoveTo,
  onReorder,
  onEdit,
  onDelete,
}: TaskKanbanProps) {
  const [dragging, setDragging] = useState<Task | null>(null)
  const [over, setOver] = useState<string | null>(null)

  function drop(status: TaskStatusRow, items: readonly Task[], index: number) {
    setOver(null)
    if (!dragging) return

    const rest = items.filter((item) => item.id !== dragging.id)
    const cut = index > items.findIndex((item) => item.id === dragging.id) ? index - 1 : index
    onReorder(dragging, status.id, beforeInList(rest, Math.max(cut, 0), dragging.listId))
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
              onDrop={() => drop(status, items, items.length)}
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
                    {items.map((task, index) => {
                      const siblings = items.filter((item) => item.listId === task.listId)
                      const slot = siblings.findIndex((item) => item.id === task.id)

                      return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          otherStatuses={statuses.filter((one) => one.id !== status.id)}
                          canMoveUp={slot > 0}
                          canMoveDown={slot < siblings.length - 1}
                          onOpen={onOpen}
                          onMoveTo={onMoveTo}
                          onMoveUp={() =>
                            onReorder(task, status.id, siblings[slot - 1]?.id ?? undefined)
                          }
                          onMoveDown={() =>
                            onReorder(task, status.id, siblings[slot + 2]?.id ?? undefined)
                          }
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onDragStart={setDragging}
                          onDropBefore={() => drop(status, items, index)}
                        />
                      )
                    })}
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
