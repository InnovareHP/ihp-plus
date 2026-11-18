'use client'

import { Button, Card, Group, Stack, Text } from '@mantine/core'
import { DIGEST_TOPIC_LABELS, type IssueRow } from '../schema'
import { DigestStatusBadge } from './digest-status-badge'
import { formatSendOn } from '../utils/format-date'

export interface IssueListProps {
  issues: readonly IssueRow[]
  selectedId: string
  onSelect: (issueId: string) => void
}

function deliveredLabel(issue: IssueRow) {
  if (issue.status !== 'sent' && issue.deliveries.length === 0) return ''
  const sent = issue.deliveries.filter((delivery) => delivery.status === 'sent').length
  return `${sent} of ${issue.deliveries.length} delivered`
}

/** Newest first; a list of cards so it reads the same at 320px as on a desktop. */
export function IssueList({ issues, selectedId, onSelect }: IssueListProps) {
  return (
    <Stack component="ul" gap="xs" p={0} m={0} style={{ listStyle: 'none' }} aria-label="Issues">
      {issues.map((issue) => {
        const selected = issue.id === selectedId
        const delivered = deliveredLabel(issue)
        return (
          <li key={issue.id}>
            <Card
              withBorder
              padding="sm"
              bg={selected ? 'var(--mantine-primary-color-light)' : undefined}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
                <Stack gap={2} miw={0}>
                  <Text fw={600} truncate>
                    {issue.title || 'Draft could not be written'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {DIGEST_TOPIC_LABELS[issue.topic]} · {formatSendOn(issue.sendOn)}
                    {delivered ? ` · ${delivered}` : ''}
                  </Text>
                  <Group gap="xs" mt={4}>
                    <DigestStatusBadge status={issue.status} />
                  </Group>
                </Stack>
                <Button
                  variant={selected ? 'light' : 'default'}
                  size="sm"
                  onClick={() => onSelect(issue.id)}
                  aria-pressed={selected}
                  aria-label={`Open ${issue.title || 'failed draft'} for ${formatSendOn(issue.sendOn)}`}
                >
                  Open
                </Button>
              </Group>
            </Card>
          </li>
        )
      })}
    </Stack>
  )
}
