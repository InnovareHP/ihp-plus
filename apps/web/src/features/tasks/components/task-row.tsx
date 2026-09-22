'use client'

import { ActionIcon, Badge, Checkbox, Group, Menu, Paper, Stack, Text } from '@mantine/core'
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
  isTaskDone,
  isTaskOverdue,
  isTaskUpcoming,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type TaskRow as Task,
} from '../schema'
import { formatDuration } from '../utils/duration'
import { ParentTaskLine } from './parent-task-line'

const due = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export interface TaskRowProps {
  task: Task
  /** Disabled at the ends of the list, so the order of the board is never ambiguous. */
  canMoveUp: boolean
  canMoveDown: boolean
  isSelected: boolean
  onSelect: (task: Task, selected: boolean) => void
  onOpen: (task: Task) => void
  onToggleComplete: (task: Task, completed: boolean) => void
  onMoveUp: (task: Task) => void
  onMoveDown: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskRow({
  task,
  canMoveUp,
  canMoveDown,
  isSelected,
  onSelect,
  onOpen,
  onToggleComplete,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: TaskRowProps) {
  const done = isTaskDone(task)
  const overdue = isTaskOverdue(task)
  const upcoming = isTaskUpcoming(task)
  const assignees = task.assignees.map((assignee) => assignee.name).join(', ')

  return (
    <Paper component="li" withBorder p="sm" radius="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <Group wrap="nowrap" align="flex-start" gap="sm" style={{ minWidth: 0 }}>
          {/* Two checkboxes, two jobs: one finishes the task, one picks it out of the list. */}
          <Checkbox
            checked={isSelected}
            onChange={(event) => onSelect(task, event.currentTarget.checked)}
            aria-label={`Select ${task.name}`}
            mt={4}
          />
          <Checkbox
            checked={done}
            onChange={(event) => onToggleComplete(task, event.currentTarget.checked)}
            aria-label={done ? `Reopen ${task.name}` : `Complete ${task.name}`}
            mt={4}
          />
          <Stack gap={4} style={{ minWidth: 0 }}>
            {/* The row's own control is its name: the checkbox and the menu sit beside it. */}
            <Text
              component="button"
              type="button"
              fw={500}
              ta="left"
              td={done ? 'line-through' : undefined}
              onClick={() => onOpen(task)}
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                cursor: 'pointer',
                wordBreak: 'break-word',
              }}
            >
              {task.name}
            </Text>
            <ParentTaskLine task={task} />
            <Group gap="xs" wrap="wrap">
              <Text size="xs" c="dimmed">
                #{task.taskNumber}
              </Text>
              <Badge size="sm" variant="light" color={TASK_PRIORITY_COLORS[task.priority]}>
                {TASK_PRIORITY_LABELS[task.priority]}
              </Badge>
              <Badge size="sm" variant="outline">
                {task.status.name}
              </Badge>
              {upcoming && task.startDate ? (
                <Text size="xs" c="dimmed">
                  Starts {due.format(new Date(task.startDate))}
                </Text>
              ) : null}
              {task.dueDate ? (
                // Colour alone never carries "late", so the word is there too.
                <Text size="xs" c={overdue ? 'red' : 'dimmed'}>
                  {overdue ? 'Overdue · ' : 'Due '}
                  {due.format(new Date(task.dueDate))}
                </Text>
              ) : null}
              {assignees ? (
                <Text size="xs" c="dimmed">
                  {assignees}
                </Text>
              ) : null}
              {task.subtasks.length > 0 ? (
                <Badge
                  size="sm"
                  variant="default"
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
                  leftSection={<IconPaperclip size={12} aria-hidden />}
                  aria-label={`${task.attachmentCount} files`}
                >
                  {task.attachmentCount}
                </Badge>
              ) : null}
            </Group>
          </Stack>
        </Group>

        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            aria-label={`Move ${task.name} up`}
            disabled={!canMoveUp}
            onClick={() => onMoveUp(task)}
          >
            <IconArrowUp size={16} aria-hidden />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            aria-label={`Move ${task.name} down`}
            disabled={!canMoveDown}
            onClick={() => onMoveDown(task)}
          >
            <IconArrowDown size={16} aria-hidden />
          </ActionIcon>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" aria-label={`Actions for ${task.name}`}>
                <IconDotsVertical size={16} aria-hidden />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconMessage size={16} aria-hidden />}
                onClick={() => onOpen(task)}
              >
                Open task
              </Menu.Item>
              <Menu.Item
                leftSection={<IconPencil size={16} aria-hidden />}
                onClick={() => onEdit(task)}
              >
                Edit task
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={16} aria-hidden />}
                onClick={() => onDelete(task)}
              >
                Delete task
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Paper>
  )
}
