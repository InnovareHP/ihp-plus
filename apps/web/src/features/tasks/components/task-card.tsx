'use client'

import { ActionIcon, Badge, Box, Group, Menu, Paper, Stack, Text } from '@mantine/core'
import {
  IconArrowDown,
  IconArrowUp,
  IconClock,
  IconDotsVertical,
  IconListCheck,
  IconMessage,
  IconPaperclip,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react'
import {
  isTaskOverdue,
  isTaskUpcoming,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type TaskRow as Task,
  type TaskStatusRow,
} from '../schema'
import { formatDuration } from '../utils/duration'
import { ParentTaskLine } from './parent-task-line'
import { ProjectTaskLine } from './project-task-line'
import touch from '@/components/touch-target.module.css'
import classes from './task-card.module.css'

const due = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

// A phone card names one person and counts the rest, so it never takes a second line.
function shortAssignees(task: Task) {
  const [first, ...rest] = task.assignees
  if (!first) return 'Unassigned'
  const name = first.name.split(/\s+/)[0] ?? first.name
  return rest.length > 0 ? `${name} +${rest.length}` : name
}

export interface TaskCardProps {
  task: Task
  /** Every other column, so the card can be moved without a mouse. */
  otherStatuses: readonly TaskStatusRow[]
  /** Disabled at the ends of the column, so the order of the board is never ambiguous. */
  canMoveUp: boolean
  canMoveDown: boolean
  onOpen: (task: Task) => void
  onMoveTo: (task: Task, statusId: string) => void
  onMoveUp: (task: Task) => void
  onMoveDown: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onDragStart: (task: Task) => void
  /** A card dropped on this one lands above it. */
  onDropBefore: (task: Task) => void
}

export function TaskCard({
  task,
  otherStatuses,
  canMoveUp,
  canMoveDown,
  onOpen,
  onMoveTo,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onDragStart,
  onDropBefore,
}: TaskCardProps) {
  const overdue = isTaskOverdue(task)
  const upcoming = isTaskUpcoming(task)

  return (
    <Paper
      component="li"
      withBorder
      radius="md"
      p="sm"
      draggable
      onDragStart={() => onDragStart(task)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        // The column behind would otherwise take the drop and send the card to the end.
        event.stopPropagation()
        onDropBefore(task)
      }}
      onClick={(event) => {
        // The menu and the name are controls of their own; anywhere else on the card opens it.
        if ((event.target as HTMLElement).closest('button, a')) return
        onOpen(task)
      }}
      style={{ cursor: 'pointer' }}
    >
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
          {/* The name stays a real button: it is the keyboard path into the task. */}
          <Text
            component="button"
            type="button"
            size="sm"
            fw={500}
            ta="left"
            className={classes.name}
            onClick={() => onOpen(task)}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
          >
            #{task.taskNumber} {task.name}
          </Text>

          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                className={touch.target}
                variant="subtle"
                color="gray"
                aria-label={`Actions for ${task.name}`}
              >
                <IconDotsVertical size={16} aria-hidden />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Order</Menu.Label>
              <Menu.Item
                leftSection={<IconArrowUp size={16} aria-hidden />}
                disabled={!canMoveUp}
                onClick={() => onMoveUp(task)}
              >
                Move up
              </Menu.Item>
              <Menu.Item
                leftSection={<IconArrowDown size={16} aria-hidden />}
                disabled={!canMoveDown}
                onClick={() => onMoveDown(task)}
              >
                Move down
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Move to</Menu.Label>
              {otherStatuses.map((status) => (
                <Menu.Item key={status.id} onClick={() => onMoveTo(task, status.id)}>
                  {status.name}
                </Menu.Item>
              ))}
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconPencil size={16} aria-hidden />}
                onClick={() => onEdit(task)}
              >
                Edit
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={16} aria-hidden />}
                onClick={() => onDelete(task)}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* A phone card keeps what someone scans for: urgency, the due date and who has it. */}
        <Box visibleFrom="sm">
          <ProjectTaskLine task={task} />
          <ParentTaskLine task={task} />
        </Box>

        <Group gap={6} wrap="wrap">
          <Badge
            size="sm"
            variant="light"
            color={TASK_PRIORITY_COLORS[task.priority]}
            visibleFrom={task.priority === 'urgent' || task.priority === 'high' ? undefined : 'sm'}
          >
            {TASK_PRIORITY_LABELS[task.priority]}
          </Badge>

          {upcoming && task.startDate ? (
            <Badge size="sm" variant="light" color="gray" visibleFrom="sm">
              Starts {due.format(new Date(task.startDate))}
            </Badge>
          ) : null}

          {task.dueDate ? (
            <Badge size="sm" variant="light" color={overdue ? 'red' : 'gray'}>
              {overdue ? 'Overdue · ' : ''}
              {due.format(new Date(task.dueDate))}
            </Badge>
          ) : null}

          {task.subtasks.length > 0 ? (
            <Badge
              size="sm"
              variant="default"
              visibleFrom="sm"
              leftSection={<IconListCheck size={12} aria-hidden />}
              aria-label={`${task.subtasks.filter((one) => one.isDone).length} of ${task.subtasks.length} subtasks done`}
            >
              {task.subtasks.filter((one) => one.isDone).length}/{task.subtasks.length}
            </Badge>
          ) : null}

          {task.trackedSeconds > 0 ? (
            <Badge
              size="sm"
              variant="default"
              visibleFrom="sm"
              leftSection={<IconClock size={12} aria-hidden />}
              aria-label={`${formatDuration(task.trackedSeconds)} tracked`}
            >
              {formatDuration(task.trackedSeconds)}
            </Badge>
          ) : null}

          {task.commentCount > 0 ? (
            <Badge
              size="sm"
              variant="default"
              visibleFrom="sm"
              leftSection={<IconMessage size={12} aria-hidden />}
              aria-label={`${task.commentCount} comments`}
            >
              {task.commentCount}
            </Badge>
          ) : null}

          {task.attachmentCount > 0 ? (
            <Badge
              size="sm"
              variant="default"
              visibleFrom="sm"
              leftSection={<IconPaperclip size={12} aria-hidden />}
              aria-label={`${task.attachmentCount} files`}
            >
              {task.attachmentCount}
            </Badge>
          ) : null}

          <Text size="xs" c="dimmed" hiddenFrom="sm" ml="auto">
            {shortAssignees(task)}
          </Text>
        </Group>

        <Text size="xs" c="dimmed" lineClamp={1} visibleFrom="sm">
          {task.assignees.length > 0
            ? task.assignees.map((one) => one.name).join(', ')
            : 'Unassigned'}
        </Text>
      </Stack>
    </Paper>
  )
}
