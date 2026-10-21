'use client'

import { Box, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { useId, useState } from 'react'
import type { TaskRow as Task, TaskStatusRow } from '../schema'
import { taskCount } from '../utils/task-count'
import { KanbanColumnBar } from './kanban-column-bar'
import { TaskCard } from './task-card'
import classes from './task-kanban.module.css'

export interface TaskKanbanProps {
  statuses: readonly TaskStatusRow[]
  tasks: readonly Task[]
  onOpen: (task: Task) => void
  onMoveTo: (task: Task, statusId: string) => void
  /** A drop carries both halves of the move: which column, and where in it. */
  onReorder: (task: Task, statusId: string, beforeTaskId: string | undefined) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  /** A search or filter is on, so every match shows rather than the first few. */
  showAll?: boolean
}

// Finished work is rarely why someone opens the board, so those columns start shorter.
const VISIBLE = { active: 10, done: 5, cancelled: 5 } as const

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
  showAll = false,
}: TaskKanbanProps) {
  const [dragging, setDragging] = useState<Task | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [over, setOver] = useState<string | null>(null)
  const columnIdBase = useId()
  const reduceMotion = useReducedMotion()
  const columnId = (statusId: string) => `${columnIdBase}-${statusId}`

  // Scrolling alone would leave a screen reader where it was, so focus follows to the column.
  function jumpTo(statusId: string) {
    const column = document.getElementById(columnId(statusId))
    column?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      inline: 'start',
      block: 'nearest',
    })
    column?.focus({ preventScroll: true })
  }

  function drop(status: TaskStatusRow, items: readonly Task[], index: number) {
    setOver(null)
    if (!dragging) return

    const rest = items.filter((item) => item.id !== dragging.id)
    const cut = index > items.findIndex((item) => item.id === dragging.id) ? index - 1 : index
    onReorder(dragging, status.id, beforeInList(rest, Math.max(cut, 0), dragging.listId))
    setDragging(null)
  }

  return (
    <Stack gap="xs">
      <KanbanColumnBar
        columns={statuses.map((status) => ({
          id: status.id,
          name: status.name,
          color: status.color,
          count: tasks.filter((task) => task.statusId === status.id).length,
        }))}
        onJump={jumpTo}
      />
      {/* The board scrolls sideways in its own container so the page never does. */}
      <Box className={classes.board} style={{ overflowX: 'auto' }} pb="sm">
        <Group align="flex-start" gap="md" wrap="nowrap">
          {statuses.map((status) => {
            const items = tasks.filter((task) => task.statusId === status.id)
            const limit = VISIBLE[status.category]
            const open = showAll || expanded.has(status.id)
            const shown = open ? items : items.slice(0, limit)
            const hidden = items.length - shown.length

            return (
              <Paper
                key={status.id}
                id={columnId(status.id)}
                tabIndex={-1}
                className={classes.column}
                component="section"
                // A named region per column, so a screen reader can jump between them.
                aria-label={`${status.name}, ${taskCount(items.length)}`}
                withBorder
                radius="md"
                p="sm"
                // The board's own width, not the screen's: the page's padding made 85vw spill past
                // the edge. 32 px short leaves a peek of the next column to say it swipes.
                w={{ base: 'calc(100% - 32px)', sm: 300 }}
                miw={{ base: 'calc(100% - 32px)', sm: 300 }}
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
                      {shown.map((task, index) => {
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

                  {!showAll && items.length > limit ? (
                    <Button
                      variant="subtle"
                      size="sm"
                      fullWidth
                      onClick={() =>
                        setExpanded((current) => {
                          const next = new Set(current)
                          if (open) next.delete(status.id)
                          else next.add(status.id)
                          return next
                        })
                      }
                    >
                      {open ? 'Show fewer' : `Show ${hidden} more`}
                    </Button>
                  ) : null}
                </Stack>
              </Paper>
            )
          })}
        </Group>
      </Box>
    </Stack>
  )
}
