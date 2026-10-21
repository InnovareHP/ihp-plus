'use client'

import { Badge, Box, Button, Group, ScrollArea } from '@mantine/core'
import { taskCount } from '../utils/task-count'

export interface KanbanColumn {
  id: string
  name: string
  color: string
  count: number
}

export interface KanbanColumnBarProps {
  columns: readonly KanbanColumn[]
  onJump: (columnId: string) => void
}

/** On a phone only one column fits, so this names them all and jumps to the one tapped. */
export function KanbanColumnBar({ columns, onJump }: KanbanColumnBarProps) {
  return (
    <ScrollArea type="never" scrollbars="x" hiddenFrom="sm">
      <Group gap="xs" wrap="nowrap" role="group" aria-label="Jump to a column" pb={4}>
        {columns.map((column) => (
          <Button
            key={column.id}
            variant="light"
            color="gray"
            size="sm"
            px="md"
            mih={44}
            radius="xl"
            flex="none"
            leftSection={
              <Box w={8} h={8} bg={column.color} aria-hidden style={{ borderRadius: '50%' }} />
            }
            aria-label={`${column.name}, ${taskCount(column.count)}`}
            onClick={() => onJump(column.id)}
          >
            {column.name}
            {/* Its own badge, so the count no longer runs into the name ("To do 0"). */}
            <Badge variant="default" size="sm" radius="xl" ml={8} aria-hidden>
              {column.count}
            </Badge>
          </Button>
        ))}
      </Group>
    </ScrollArea>
  )
}
