'use client'

import { ActionIcon, Button, Group, Menu, Stack, Text, Title } from '@mantine/core'
import { IconDotsVertical, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useMemo } from 'react'
import { EmptyState } from '@/components/empty-state'
import type { TaskListRow, TaskRow as Task } from '../schema'
import { groupTasksByStatus } from '../utils/group-by-status'
import { TaskStatusGroup } from './task-status-group'

export interface TaskListSectionProps {
  list: TaskListRow
  tasks: readonly Task[]
  onAdd: (list: TaskListRow) => void
  onRenameList: (list: TaskListRow) => void
  onDeleteList: (list: TaskListRow) => void
  onOpen: (task: Task) => void
  onToggleComplete: (task: Task, completed: boolean) => void
  onMove: (task: Task, direction: 'up' | 'down') => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskListSection({
  list,
  tasks,
  onAdd,
  onRenameList,
  onDeleteList,
  onOpen,
  onToggleComplete,
  onMove,
  onEdit,
  onDelete,
}: TaskListSectionProps) {
  const groups = useMemo(() => groupTasksByStatus(tasks), [tasks])

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
        <Group gap={4} wrap="nowrap">
          <Button
            variant="subtle"
            size="sm"
            leftSection={<IconPlus size={16} aria-hidden />}
            onClick={() => onAdd(list)}
          >
            Add task
          </Button>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${list.name}`}>
                <IconDotsVertical size={16} aria-hidden />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconPencil size={16} aria-hidden />}
                onClick={() => onRenameList(list)}
              >
                Rename list
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={16} aria-hidden />}
                onClick={() => onDeleteList(list)}
              >
                Delete list
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
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
        <Stack gap="sm">
          {groups.map((group) => (
            <TaskStatusGroup
              key={group.status.id}
              status={group.status}
              items={group.items}
              // Closed work is history; it stays folded away until someone asks for it.
              defaultOpen={group.status.category === 'active'}
              onOpen={onOpen}
              onToggleComplete={onToggleComplete}
              onMove={onMove}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
