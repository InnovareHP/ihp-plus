'use client'

import { Box, Group, Stack } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useId, useRef, useState } from 'react'
import type { TaskRow as Task, TaskStatusRow } from '../schema'
import { beforeTaskIdFor } from '../utils/drag-order'
import { KanbanColumnBar } from './kanban-column-bar'
import { TaskColumn } from './task-column'
import { TaskDragPreview } from './task-drag-preview'
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

const COLUMN = 'column:'

const INSTRUCTIONS =
  'To move a task, press Space or Enter on its drag handle, use the arrow keys to move it, then press Space or Enter to drop it, or Escape to cancel.'

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
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  // While a card is held, the shown order of every column lives here so cards make room live.
  const [preview, setPreview] = useState<Record<string, string[]> | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const startOrder = useRef<Record<string, string[]>>({})
  const justDropped = useRef(false)
  const columnIdBase = useId()
  const reduceMotion = useReducedMotion()
  const columnId = (statusId: string) => `${columnIdBase}-${statusId}`

  const sensors = useSensors(
    // A few pixels of travel before a drag, so a plain click still opens the card.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold on a phone, so a swipe still scrolls the board and the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const byId = new Map(tasks.map((task) => [task.id, task]))
  const columnItems = (statusId: string) => tasks.filter((task) => task.statusId === statusId)

  function shownIds(status: TaskStatusRow) {
    const items = columnItems(status.id)
    const open = showAll || expanded.has(status.id)
    return (open ? items : items.slice(0, VISIBLE[status.category])).map((task) => task.id)
  }

  function containerOf(id: UniqueIdentifier, order: Record<string, string[]>) {
    const key = String(id)
    if (key.startsWith(COLUMN)) return key.slice(COLUMN.length)
    return Object.keys(order).find((statusId) => order[statusId]?.includes(key))
  }

  const nameOf = (id: UniqueIdentifier) => byId.get(String(id))?.name ?? 'the task'
  const columnNameOf = (id: UniqueIdentifier) => {
    const statusId = containerOf(id, preview ?? startOrder.current)
    return statuses.find((status) => status.id === statusId)?.name ?? 'the board'
  }

  // Named for people, not ids: dnd-kit announces these in its own live region.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${columnNameOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped in ${columnNameOf(over.id)}.`
        : `${nameOf(active.id)} put back.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  }

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

  function handleDragStart({ active }: DragStartEvent) {
    const order = Object.fromEntries(statuses.map((status) => [status.id, shownIds(status)]))
    startOrder.current = order
    setPreview(order)
    setActiveId(String(active.id))
  }

  // Crossing into another column moves the card there at once, so that column opens a gap for it.
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    setPreview((current) => {
      if (!current) return current
      const from = containerOf(active.id, current)
      const to = containerOf(over.id, current)
      if (!from || !to || from === to) return current

      const moving = String(active.id)
      const target = current[to] ?? []
      const overIndex = target.indexOf(String(over.id))
      const at = overIndex === -1 ? target.length : overIndex
      return {
        ...current,
        [from]: (current[from] ?? []).filter((id) => id !== moving),
        [to]: [...target.slice(0, at), moving, ...target.slice(at)],
      }
    })
  }

  function reset() {
    setPreview(null)
    setActiveId(null)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const current = preview
    reset()
    const task = byId.get(String(active.id))
    if (!over || !current || !task) return

    const to = containerOf(over.id, current)
    if (!to) return
    let order = current[to] ?? []
    const from = order.indexOf(task.id)
    const overIndex = order.indexOf(String(over.id))
    if (from !== -1 && overIndex !== -1 && from !== overIndex) {
      order = arrayMove(order, from, overIndex)
    }

    // A drop where the card started is no move at all, so nothing is sent.
    const unchanged = to === task.statusId && order.join() === (startOrder.current[to] ?? []).join()
    if (unchanged) return

    // A drop ends with a click on the card underneath, which must not also open it.
    justDropped.current = true
    window.setTimeout(() => (justDropped.current = false), 0)

    const column = columnItems(to)
    onReorder(task, to, beforeTaskIdFor(order, task.id, column, task.listId))
  }

  function open(task: Task) {
    if (justDropped.current) return
    onOpen(task)
  }

  const active = activeId ? byId.get(activeId) : undefined
  const activeColumn = activeId && preview ? containerOf(activeId, preview) : undefined

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={reset}
      >
        {/* The board scrolls sideways in its own container so the page never does. */}
        <Box
          className={classes.board}
          data-dragging={activeId ? true : undefined}
          style={{ overflowX: 'auto' }}
          pb="sm"
        >
          <Group align="flex-start" gap="md" wrap="nowrap">
            {statuses.map((status) => {
              const items = columnItems(status.id)
              const isOpen = showAll || expanded.has(status.id)
              const ids = preview?.[status.id] ?? shownIds(status)
              const shown = ids.flatMap((id) => byId.get(id) ?? [])

              return (
                <TaskColumn
                  key={status.id}
                  id={columnId(status.id)}
                  status={status}
                  items={items}
                  shown={shown}
                  hiddenCount={items.length - shownIds(status).length}
                  canToggle={!showAll && items.length > VISIBLE[status.category]}
                  expanded={isOpen}
                  onToggle={() =>
                    setExpanded((current) => {
                      const next = new Set(current)
                      if (isOpen) next.delete(status.id)
                      else next.add(status.id)
                      return next
                    })
                  }
                  highlighted={activeColumn === status.id && activeColumn !== active?.statusId}
                  reduceMotion={reduceMotion}
                  statuses={statuses}
                  onOpen={open}
                  onMoveTo={onMoveTo}
                  onReorder={onReorder}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              )
            })}
          </Group>
        </Box>
        <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
          {active ? <TaskDragPreview task={active} /> : null}
        </DragOverlay>
      </DndContext>
    </Stack>
  )
}
