'use client'

import { ActionIcon, Badge, Group, Menu, Paper, Stack, Text } from '@mantine/core'
import {
  IconDotsVertical,
  IconMessage,
  IconPaperclip,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react'
import {
  isTaskOverdue,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type TaskRow as Task,
  type TaskStatusRow,
} from '../schema'

const due = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export interface TaskCardProps {
  task: Task
  /** Every other column, so the card can be moved without a mouse. */
  otherStatuses: readonly TaskStatusRow[]
  onOpen: (task: Task) => void
  onMoveTo: (task: Task, statusId: string) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onDragStart: (task: Task) => void
}

export function TaskCard({
  task,
  otherStatuses,
  onOpen,
  onMoveTo,
  onEdit,
  onDelete,
  onDragStart,
}: TaskCardProps) {
  const overdue = isTaskOverdue(task)

  return (
    <Paper
      component="li"
      withBorder
      radius="md"
      p="sm"
      draggable
      onDragStart={() => onDragStart(task)}
    >
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
          {/* The whole card is not the control: a drag target that is also a button fires both. */}
          <Text
            component="button"
            type="button"
            size="sm"
            fw={500}
            ta="left"
            onClick={() => onOpen(task)}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
          >
            #{task.taskNumber} {task.name}
          </Text>

          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${task.name}`}>
                <IconDotsVertical size={16} aria-hidden />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
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

        <Group gap={6} wrap="wrap">
          <Badge size="sm" variant="light" color={TASK_PRIORITY_COLORS[task.priority]}>
            {TASK_PRIORITY_LABELS[task.priority]}
          </Badge>

          {task.dueDate ? (
            <Badge size="sm" variant="light" color={overdue ? 'red' : 'gray'}>
              {overdue ? 'Overdue · ' : ''}
              {due.format(new Date(task.dueDate))}
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

        <Text size="xs" c="dimmed" lineClamp={1}>
          {task.assignees.length > 0
            ? task.assignees.map((one) => one.name).join(', ')
            : 'Unassigned'}
        </Text>
      </Stack>
    </Paper>
  )
}
