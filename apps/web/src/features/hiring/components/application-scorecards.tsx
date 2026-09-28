'use client'

import { Badge, Card, Group, Stack, Text } from '@mantine/core'
import { FormAnswers } from '@/components/form-answers'
import { PageSection } from '@/components/page-section'
import { describeMoment } from '@/lib/relative-time'
import { RECOMMENDATION_COLORS, RECOMMENDATION_LABELS, type ScorecardRow } from '../schema'

export function ApplicationScorecards({ scorecards }: { scorecards: readonly ScorecardRow[] }) {
  const tally = scorecards.reduce<Record<string, number>>((counts, row) => {
    counts[row.recommendation] = (counts[row.recommendation] ?? 0) + 1
    return counts
  }, {})

  return (
    <PageSection
      title="Scorecards"
      description={
        scorecards.length === 0
          ? undefined
          : Object.entries(tally)
              .map(
                ([value, count]) =>
                  `${count} ${RECOMMENDATION_LABELS[value as keyof typeof RECOMMENDATION_LABELS].toLowerCase()}`,
              )
              .join(' · ')
      }
    >
      {scorecards.length === 0 ? (
        <Text size="sm" c="dimmed">
          Interviewers fill these in after meeting them; each one shows up here.
        </Text>
      ) : (
        <Stack gap="sm">
          {scorecards.map((row) => (
            <Card key={`${row.interviewId}:${row.interviewerId}`} withBorder padding="md">
              <Stack gap="sm">
                <Group justify="space-between" wrap="wrap" gap="xs">
                  <Text fw={600} size="sm">
                    {row.interviewerName}
                  </Text>
                  <Group gap="xs">
                    <Badge color={RECOMMENDATION_COLORS[row.recommendation]} variant="light">
                      {RECOMMENDATION_LABELS[row.recommendation]}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {describeMoment(row.updatedAt)}
                    </Text>
                  </Group>
                </Group>
                {row.fields.length > 0 ? (
                  <FormAnswers fields={row.fields} values={row.values} />
                ) : null}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </PageSection>
  )
}
