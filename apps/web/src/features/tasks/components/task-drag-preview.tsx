import { Paper, Text } from '@mantine/core'
import type { TaskRow as Task } from '../schema'

// The copy that follows the pointer: just the name, so it stays light while it moves.
export function TaskDragPreview({ task }: { task: Task }) {
  return (
    <Paper withBorder radius="md" p="sm" shadow="md" style={{ cursor: 'grabbing' }}>
      <Text size="sm" fw={500} lineClamp={2}>
        #{task.taskNumber} {task.name}
      </Text>
    </Paper>
  )
}
