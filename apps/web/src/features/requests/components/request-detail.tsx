'use client'

import { Alert, Badge, Card, Group, Stack, Text } from '@mantine/core'
import { PageSection } from '@/components/page-shell'
import { announceSuccess } from '@/lib/announce'
import { REQUEST_STATUS_COLORS, REQUEST_STATUS_LABELS, type RequestRow } from '../schema'
import { useDecideOne, useRequest } from '../use-requests'
import { DecisionFields } from './decision-fields'
import { RequestAnswers } from './request-answers'

const stamp = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function RequestDetail({ initial }: { initial: RequestRow }) {
  const request = useRequest(initial.id)
  const row = request.data ?? initial

  return (
    <Stack gap="lg">
      <Card padding="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Raised by {row.requesterName}
              {row.teamName ? ` · ${row.teamName}` : ''}
            </Text>
            <Text size="sm" c="dimmed">
              {stamp.format(new Date(row.createdAt))}
            </Text>
          </Stack>
          <Badge size="lg" color={REQUEST_STATUS_COLORS[row.status]} variant="light">
            {REQUEST_STATUS_LABELS[row.status]}
          </Badge>
        </Group>
      </Card>

      {row.status !== 'pending' && (row.decidedBy || row.decisionNote) ? (
        <Alert
          color={REQUEST_STATUS_COLORS[row.status]}
          variant="light"
          title={`${REQUEST_STATUS_LABELS[row.status]}${row.decidedBy ? ` by ${row.decidedBy}` : ''}`}
        >
          <Text size="sm">{row.decisionNote || 'No note was left.'}</Text>
        </Alert>
      ) : null}

      <PageSection title="Answers" description="Shown against the questions as they were asked.">
        <RequestAnswers fields={row.fields} values={row.values} />
      </PageSection>

      {row.canDecide ? <DecisionPanel row={row} /> : null}
    </Stack>
  )
}

function DecisionPanel({ row }: { row: RequestRow }) {
  const decide = useDecideOne()

  return (
    <PageSection
      title="Your decision"
      description="The requester sees the outcome and your note straight away."
    >
      <Stack maw={620}>
        <DecisionFields
          label="request"
          isPending={decide.isPending}
          onDecide={(decision, note) =>
            decide.mutate(
              { submissionId: row.id, decision, note },
              {
                onSuccess: (updated) =>
                  announceSuccess(
                    `${updated.formName} ${updated.status === 'approved' ? 'approved' : 'rejected'}.`,
                  ),
              },
            )
          }
        />
      </Stack>
    </PageSection>
  )
}
