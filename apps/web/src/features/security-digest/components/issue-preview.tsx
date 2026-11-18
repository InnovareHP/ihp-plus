'use client'

import { Alert, Button, Card, Divider, Group, Image, List, Stack, Text, Title } from '@mantine/core'
import { securityDigestImageHref } from '@/lib/routes'
import { DIGEST_TOPIC_LABELS, type IssueRow } from '../schema'
import { formatSendOn } from '../utils/format-date'
import { DeliveryList } from './delivery-list'
import { DigestStatusBadge } from './digest-status-badge'

export interface IssuePreviewProps {
  issue: IssueRow
  canManage: boolean
  pending: { approve: boolean; reject: boolean; send: boolean; test: boolean }
  onApprove: () => void
  onReject: () => void
  onSendNow: () => void
  onSendTest: () => void
}

/** The issue as recipients will read it, with the one decision IT has to make about it. */
export function IssuePreview({
  issue,
  canManage,
  pending,
  onApprove,
  onReject,
  onSendNow,
  onSendTest,
}: IssuePreviewProps) {
  const hasContent = Boolean(issue.title)
  return (
    <Card withBorder padding="lg" component="section" aria-labelledby="issue-preview-title">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Stack gap={2}>
            <Text size="sm" c="dimmed">
              {DIGEST_TOPIC_LABELS[issue.topic]} · goes out {formatSendOn(issue.sendOn)}
            </Text>
            <Title order={2} id="issue-preview-title">
              {issue.title || 'This draft could not be written'}
            </Title>
          </Stack>
          <DigestStatusBadge status={issue.status} />
        </Group>

        {issue.error ? (
          <Alert color="red" variant="light" title="What went wrong">
            {issue.error}
          </Alert>
        ) : null}

        {hasContent ? (
          <>
            <Image
              src={securityDigestImageHref(issue.id)}
              alt={issue.title}
              w="100%"
              maw={496}
              h="auto"
              radius="md"
              style={{ aspectRatio: '2 / 1' }}
            />
            {issue.intro.map((paragraph, index) => (
              <Text key={index}>{paragraph}</Text>
            ))}
            <Text fw={600}>What to do:</Text>
            <List type="ordered" spacing="xs">
              {issue.tips.map((tip, index) => (
                <List.Item key={index}>{tip}</List.Item>
              ))}
            </List>
            <Text c="dimmed" size="sm">
              {issue.takeaway}
            </Text>
          </>
        ) : null}

        {canManage && hasContent ? (
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onSendTest} loading={pending.test}>
              Send me a test
            </Button>
            {issue.status === 'draft' || issue.status === 'approved' ? (
              <Button variant="default" color="red" onClick={onReject} loading={pending.reject}>
                Reject issue
              </Button>
            ) : null}
            {issue.status === 'draft' ? (
              <Button onClick={onApprove} loading={pending.approve}>
                Approve for {formatSendOn(issue.sendOn)}
              </Button>
            ) : null}
            {issue.status === 'approved' ? (
              <Button onClick={onSendNow} loading={pending.send}>
                Send now
              </Button>
            ) : null}
          </Group>
        ) : null}

        <Divider />
        <Stack gap="xs">
          <Title order={3}>Deliveries</Title>
          {issue.decidedByName ? (
            <Text size="sm" c="dimmed">
              {issue.status === 'rejected' ? 'Rejected' : 'Approved'} by {issue.decidedByName}
            </Text>
          ) : null}
          <DeliveryList deliveries={issue.deliveries} />
        </Stack>
      </Stack>
    </Card>
  )
}
