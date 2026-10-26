'use client'

import { Box, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { TaskRow as Task, TaskStatusRow } from '../schema'
import { taskCount } from '../utils/task-count'
import { SortableTaskCard } from './sortable-task-card'
import classes from './task-kanban.module.css'

export interface TaskColumnProps {
  id: string
  status: TaskStatusRow
  /** Every task in the column, for its count and for moving up and down within a list. */
  items: readonly Task[]
  /** The cards on screen, in order, including one dragged in from another column. */
  shown: readonly Task[]
  hiddenCount: number
  canToggle: boolean
  expanded: boolean
  onToggle: () => void
  highlighted: boolean
  reduceMotion: boolean
  statuses: readonly TaskStatusRow[]
  onOpen: (task: Task) => void
  onMoveTo: (task: Task, statusId: string) => void
  onReorder: (task: Task, statusId: string, beforeTaskId: string | undefined) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskColumn({
  id,
  status,
  items,
  shown,
  hiddenCount,
  canToggle,
  expanded,
  onToggle,
  highlighted,
  reduceMotion,
  statuses,
  onOpen,
  onMoveTo,
  onReorder,
  onEdit,
  onDelete,
}: TaskColumnProps) {
  // The whole column takes a drop, so an empty one or the space under the last card works too.
  const { setNodeRef } = useDroppable({ id: `column:${status.id}`, data: { statusId: status.id } })

  return (
    <Paper
      ref={setNodeRef}
      id={id}
      tabIndex={-1}
      className={classes.column}
      component="section"
      // A named region per column, so a screen reader can jump between them.
      aria-label={`${status.name}, ${taskCount(items.length)}`}
      withBorder
      radius="md"
      p="sm"
      // The board's own width, not the screen's: 32 px short leaves a peek of the next column.
      w={{ base: 'calc(100% - 32px)', sm: 300 }}
      miw={{ base: 'calc(100% - 32px)', sm: 300 }}
      bg={highlighted ? 'var(--mantine-color-default-hover)' : undefined}
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

        <SortableContext
          items={shown.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {shown.length === 0 ? (
            <Text size="xs" c="dimmed" className={classes.emptyDrop}>
              Nothing here.
            </Text>
          ) : (
            <Stack component="ul" gap="xs" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {shown.map((task) => {
                const siblings = items.filter((item) => item.listId === task.listId)
                const slot = siblings.findIndex((item) => item.id === task.id)

                return (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    statusId={status.id}
                    reduceMotion={reduceMotion}
                    otherStatuses={statuses.filter((one) => one.id !== status.id)}
                    canMoveUp={slot > 0}
                    canMoveDown={slot !== -1 && slot < siblings.length - 1}
                    onOpen={onOpen}
                    onMoveTo={onMoveTo}
                    onMoveUp={() => onReorder(task, status.id, siblings[slot - 1]?.id ?? undefined)}
                    onMoveDown={() =>
                      onReorder(task, status.id, siblings[slot + 2]?.id ?? undefined)
                    }
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                )
              })}
            </Stack>
          )}
        </SortableContext>

        {canToggle ? (
          <Button variant="subtle" size="sm" fullWidth onClick={onToggle}>
            {expanded ? 'Show fewer' : `Show ${hiddenCount} more`}
          </Button>
        ) : null}
      </Stack>
    </Paper>
  )
}
