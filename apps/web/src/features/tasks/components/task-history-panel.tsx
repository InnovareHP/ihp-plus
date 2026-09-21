'use client'

import { Skeleton, Stack, Text } from '@mantine/core'
import { ActivityTimeline } from '@/components/activity-timeline'
import { useTaskActivity } from '../hooks/use-conversation'
import type { TaskRow } from '../schema'

export interface TaskHistoryPanelProps {
  task: TaskRow
  /** False until the tab is opened, so a task nobody audits costs no query. */
  isActive: boolean
}

export function TaskHistoryPanel({ task, isActive }: TaskHistoryPanelProps) {
  const activity = useTaskActivity(task.id, isActive)

  if (activity.isPending) {
    return (
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={60} radius="md" />
        <Skeleton height={60} radius="md" />
      </Stack>
    )
  }

  if (activity.isError) {
    return (
      <Text size="sm" c="dimmed">
        Could not load the history of this task.
      </Text>
    )
  }

  return (
    <ActivityTimeline items={activity.data ?? []} label={`History of task ${task.taskNumber}`} />
  )
}
