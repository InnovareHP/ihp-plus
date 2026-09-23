'use client'

import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { useCorrectionQueue, useDecideCorrection } from '../hooks/use-corrections'
import type { AttendanceCorrectionRow } from '../schema'
import { RejectCorrectionModal } from './reject-correction-modal'

const dayLabel = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString([], {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

/** Members' requests to put a day right, oldest waiting longest at the bottom of the day's work. */
export function CorrectionsQueue() {
  const queue = useCorrectionQueue()
  const decide = useDecideCorrection()
  // Which request the reason dialog is open on is a disclosure nothing else reads.
  const [rejecting, setRejecting] = useState<AttendanceCorrectionRow | undefined>(undefined)

  // An empty queue has nothing to act on, so it takes no room above the timesheet.
  if (queue.isSuccess && queue.data.length === 0) return null

  const columns: DataTableColumn<AttendanceCorrectionRow>[] = [
    {
      key: 'person',
      header: 'Employee',
      rowHeader: true,
      render: (row) => (
        <Text size="sm" fw={500}>
          {row.userName}
        </Text>
      ),
    },
    { key: 'day', header: 'Day', render: (row) => dayLabel(row.workDate) },
    {
      key: 'asked',
      header: 'Asked for',
      render: (row) =>
        `${row.clockInTime}–${row.clockOutTime}${row.breakMinutes > 0 ? `, ${row.breakMinutes} min break` : ''}`,
    },
    {
      key: 'reason',
      header: 'What happened',
      render: (row) => (
        <Text size="sm" c="dimmed">
          {row.reason}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) =>
        row.canDecide ? (
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            <Button
              size="compact-sm"
              onClick={() =>
                decide.mutate({ correctionId: row.id, decision: 'approved', note: '' })
              }
              aria-label={`Approve ${row.userName}'s correction for ${dayLabel(row.workDate)}`}
            >
              Approve
            </Button>
            <Button
              size="compact-sm"
              variant="subtle"
              color="red"
              onClick={() => setRejecting(row)}
              aria-label={`Turn down ${row.userName}'s correction for ${dayLabel(row.workDate)}`}
            >
              Turn down
            </Button>
          </Group>
        ) : null,
    },
  ]

  return (
    <Card padding="lg" component="section" aria-labelledby="corrections-heading" withBorder>
      <Stack gap="md">
        <Group gap="xs">
          <Title order={2} size="h5" id="corrections-heading">
            Correction requests
          </Title>
          {queue.data ? (
            <Badge color="yellow" variant="light">
              {queue.data.length} waiting
            </Badge>
          ) : null}
        </Group>
        <Text size="xs" c="dimmed">
          Approving writes the day as asked, which also clears a missed clock-out. Either way the
          member is emailed.
        </Text>
        <DataTable
          label="Correction requests"
          columns={columns}
          rows={queue.data}
          rowKey={(row) => row.id}
          isPending={queue.isPending}
          isError={queue.isError}
          isFetching={queue.isFetching}
          onRetry={() => void queue.refetch()}
          errorTitle="Could not load correction requests"
          minWidth={760}
          empty={null}
        />
        <RejectCorrectionModal
          correction={rejecting}
          onClose={() => setRejecting(undefined)}
          onReject={(row, note) =>
            decide.mutate({ correctionId: row.id, decision: 'rejected', note })
          }
        />
      </Stack>
    </Card>
  )
}
