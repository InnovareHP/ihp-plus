import { Text } from '@mantine/core'
import type { TaskRow } from '../schema'

/** On a board spanning every project, each card says which project it belongs to. */
export function ProjectTaskLine({ task }: { task: TaskRow }) {
  if (!task.projectName) return null

  return (
    <Text size="xs" c="dimmed" lineClamp={1}>
      {task.projectName}
    </Text>
  )
}
