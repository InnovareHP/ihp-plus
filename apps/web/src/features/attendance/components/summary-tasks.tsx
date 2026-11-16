'use client'

import { Badge, Stack, Text, Title } from '@mantine/core'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import type { SummaryTaskRow } from '../schema'
import { formatStatementDate } from '../utils/billing-statement'

export interface SummaryTasksProps {
  title: string
  tasks: readonly SummaryTaskRow[]
}

const columns: DataTableColumn<SummaryTaskRow>[] = [
  {
    key: 'date',
    header: 'Day',
    width: 130,
    render: (task) => formatStatementDate(task.dueDate),
  },
  {
    key: 'name',
    header: 'Task',
    rowHeader: true,
    render: (task) => <Text size="sm">{task.name}</Text>,
  },
  {
    key: 'status',
    header: 'Status',
    align: 'right',
    render: (task) =>
      task.isDone ? (
        <Badge color="teal" variant="light">
          Done
        </Badge>
      ) : (
        <Badge color="gray" variant="light">
          Not done
        </Badge>
      ),
  },
]

/** The tasks someone planned at clock-in over the range, oldest day first. */
export function SummaryTasks({ title, tasks }: SummaryTasksProps) {
  return (
    <Stack gap="xs" component="section" aria-label={title}>
      <Title order={4} size="h6">
        {title}
      </Title>
      <DataTable
        label={title}
        columns={columns}
        rows={tasks}
        rowKey={(task) => task.id}
        isPending={false}
        density="compact"
        empty={
          <EmptyState
            title="No daily tasks in this range"
            description="Tasks appear here once they plan their day at clock-in."
          />
        }
      />
    </Stack>
  )
}
