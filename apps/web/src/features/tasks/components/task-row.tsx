'use client'

import { ActionIcon, Badge, Checkbox, Group, Menu, Paper, Stack, Text } from '@mantine/core'
import {
  IconArrowDown,
  IconArrowUp,
  IconDotsVertical,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react'
import {
  isTaskDone,
  isTaskOverdue,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type TaskRow as Task,
} from '../schema'

const due = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export interface TaskRowProps {
  task: Task
  /** Disabled at the ends of the list, so the order of the board is never ambiguous. */
  canMoveUp: boolean
  canMoveDown: boolean
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
  onToggleComplete,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: TaskRowProps) {
  const done = isTaskDone(task)
  const overdue = isTaskOverdue(task)
  const assignees = task.assignees.map((assignee) => assignee.name).join(', ')

  return (
    <Paper component="li" withBorder p="sm" radius="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <Group wrap="nowrap" align="flex-start" gap="sm" style={{ minWidth: 0 }}>
          <Checkbox
            checked={done}
            onChange={(event) => onToggleComplete(task, event.currentTarget.checked)}
            aria-label={done ? `Reopen ${task.name}` : `Complete ${task.name}`}
            mt={4}
          />
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Text
              fw={500}
              td={done ? 'line-through' : undefined}
              style={{ wordBreak: 'break-word' }}
            >
              {task.name}
            </Text>
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
