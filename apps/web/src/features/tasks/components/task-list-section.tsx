'use client'

import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { EmptyState } from '@/components/empty-state'
import type { TaskListRow, TaskRow as Task } from '../schema'
import { TaskRow } from './task-row'

export interface TaskListSectionProps {
  list: TaskListRow
  tasks: readonly Task[]
  onAdd: (list: TaskListRow) => void
  onToggleComplete: (task: Task, completed: boolean) => void
  onMove: (task: Task, direction: 'up' | 'down') => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskListSection({
  list,
  tasks,
  onAdd,
  onToggleComplete,
  onMove,
  onEdit,
  onDelete,
}: TaskListSectionProps) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="baseline" wrap="wrap" gap="xs">
        <Group gap="xs" align="baseline">
          <Title order={3} size="h4">
            {list.name}
          </Title>
          <Text size="sm" c="dimmed">
            {tasks.length === 1 ? '1 task' : `${tasks.length} tasks`}
          </Text>
        </Group>
        <Button
          variant="subtle"
          size="sm"
          leftSection={<IconPlus size={16} aria-hidden />}
          onClick={() => onAdd(list)}
        >
          Add task
        </Button>
      </Group>

      {tasks.length === 0 ? (
        <EmptyState
          title={`Nothing in ${list.name} yet`}
          description="Add the first task so the work in this list is visible to everyone."
          action={
            <Button size="sm" onClick={() => onAdd(list)}>
              Add task
            </Button>
          }
        />
      ) : (
        <Stack component="ul" gap="xs" p={0} style={{ listStyle: 'none' }}>
          {tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              canMoveUp={index > 0}
              canMoveDown={index < tasks.length - 1}
              onToggleComplete={onToggleComplete}
              onMoveUp={(row) => onMove(row, 'up')}
              onMoveDown={(row) => onMove(row, 'down')}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
