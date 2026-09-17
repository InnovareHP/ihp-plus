'use client'

import { SimpleGrid } from '@mantine/core'
import { StatCard } from '@/components/stat-card'
import { isTaskDone, isTaskOverdue, type TaskRow } from '../schema'

export interface TaskStatsProps {
  tasks: readonly TaskRow[]
}

export function TaskStats({ tasks }: TaskStatsProps) {
  const done = tasks.filter(isTaskDone).length
  const overdue = tasks.filter((task) => isTaskOverdue(task)).length
  const unassigned = tasks.filter((task) => task.assignees.length === 0).length

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
      <StatCard label="Open" value={tasks.length - done} hint="Still to finish on this board" />
      <StatCard label="Done" value={done} hint="Closed in a done column" />
      <StatCard label="Overdue" value={overdue} hint="Past their due date and still open" />
      <StatCard label="Unassigned" value={unassigned} hint="Nobody has picked these up" />
    </SimpleGrid>
  )
}
