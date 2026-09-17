'use client'

import { Badge, Card, Group, Stack, Text } from '@mantine/core'
import { FormAnswers } from '@/components/form-answers'
import { PageSection } from '@/components/page-section'
import { useEvaluation } from '../hooks/use-evaluations'
import { EVALUATION_STATUS_COLORS, EVALUATION_STATUS_LABELS, type EvaluationRow } from '../schema'

const stamp = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function EvaluationDetail({ initial }: { initial: EvaluationRow }) {
  const evaluation = useEvaluation(initial.id)
  const row = evaluation.data ?? initial

  return (
    <Stack gap="lg">
      <Card padding="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              About {row.employeeName}
              {row.employeeTeam ? ` · ${row.employeeTeam}` : ''}
              {row.employeeEmploymentStatus ? ` · ${row.employeeEmploymentStatus}` : ''}
            </Text>
            <Text size="sm" c="dimmed">
              Filled in by {row.evaluatorName}
              {row.submittedAt ? ` · ${stamp.format(new Date(row.submittedAt))}` : ''}
            </Text>
          </Stack>
          <Badge size="lg" color={EVALUATION_STATUS_COLORS[row.status]} variant="light">
            {EVALUATION_STATUS_LABELS[row.status]}
          </Badge>
        </Group>
      </Card>

      <PageSection title="Answers" description="Shown against the questions as they were asked.">
        <FormAnswers fields={row.fields} values={row.values} />
      </PageSection>
    </Stack>
  )
}
