'use client'

import { Checkbox, List } from '@mantine/core'
import type { ChecklistTask } from '../schema'

export interface FirstDayTaskListProps {
  items: readonly ChecklistTask[]
  onToggle: (taskId: string, done: boolean) => void
}

export function FirstDayTaskList({ items, onToggle }: FirstDayTaskListProps) {
  return (
    <List listStyleType="none" spacing="sm">
      {items.map((item) => (
        <List.Item key={item.id}>
          <Checkbox
            label={item.title}
            description={item.description}
            checked={item.done}
            onChange={(event) => onToggle(item.id, event.currentTarget.checked)}
          />
        </List.Item>
      ))}
    </List>
  )
}
