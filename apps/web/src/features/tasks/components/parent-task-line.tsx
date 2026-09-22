import { Text } from '@mantine/core'
import type { TaskRow } from '../schema'

/** A subtask is a card like any other, so it says on itself which task it belongs to. */
export function ParentTaskLine({ task }: { task: TaskRow }) {
  if (!task.parentName) return null

  return (
    <Text size="xs" c="dimmed" lineClamp={1}>
      ↳ Part of {task.parentNumber ? `#${task.parentNumber} ` : ''}
      {task.parentName}
    </Text>
  )
}
