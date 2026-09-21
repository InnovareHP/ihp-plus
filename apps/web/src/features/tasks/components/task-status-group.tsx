'use client'

import { Badge, Collapse, Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconChevronRight } from '@tabler/icons-react'
import { useId } from 'react'
import type { TaskRow as Task, TaskStatusRow } from '../schema'
import { TaskRow } from './task-row'

export interface TaskStatusGroupItem {
  task: Task
  /** Ordering stays a property of the whole list, so the arrows follow the list, not the group. */
  canMoveUp: boolean
  canMoveDown: boolean
}

export interface TaskStatusGroupProps {
  status: TaskStatusRow
  items: readonly TaskStatusGroupItem[]
  defaultOpen: boolean
  onOpen: (task: Task) => void
  onToggleComplete: (task: Task, completed: boolean) => void
  onMove: (task: Task, direction: 'up' | 'down') => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskStatusGroup({
  status,
  items,
  defaultOpen,
  onOpen,
  onToggleComplete,
  onMove,
  onEdit,
  onDelete,
}: TaskStatusGroupProps) {
  const [opened, disclosure] = useDisclosure(defaultOpen)
  const panelId = useId()

  return (
    <Paper withBorder radius="md" p="sm">
      <UnstyledButton
        onClick={disclosure.toggle}
        aria-expanded={opened}
        aria-controls={panelId}
        w="100%"
      >
        <Group gap="xs" wrap="nowrap">
          <IconChevronRight
            size={16}
            aria-hidden
            style={{
              transform: opened ? 'rotate(90deg)' : undefined,
              transition: 'transform 150ms ease-out',
            }}
          />
          <Badge
            size="sm"
            variant="light"
            color="gray"
            // The status colour is organization data, not a theme token, so it stays a raw swatch.
            leftSection={
              <span
                aria-hidden
                style={{
                  display: 'block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: status.color,
                }}
              />
            }
          >
            {status.name}
          </Badge>
          <Text size="sm" c="dimmed">
            {items.length === 1 ? '1 task' : `${items.length} tasks`}
          </Text>
        </Group>
      </UnstyledButton>

      <Collapse expanded={opened} id={panelId}>
        <Stack component="ul" gap="xs" p={0} pt="sm" style={{ listStyle: 'none' }}>
          {items.map(({ task, canMoveUp, canMoveDown }) => (
            <TaskRow
              key={task.id}
              task={task}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onOpen={onOpen}
              onToggleComplete={onToggleComplete}
              onMoveUp={(row) => onMove(row, 'up')}
              onMoveDown={(row) => onMove(row, 'down')}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Stack>
      </Collapse>
    </Paper>
  )
}
