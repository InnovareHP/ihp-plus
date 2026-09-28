'use client'

import { Anchor, Badge, Button, Card, Group, List, Modal, Stack, Text } from '@mantine/core'
import Link from 'next/link'
import { interviewRoute } from '@/lib/routes'
import { useDisclosure } from '@mantine/hooks'
import {
  INTERVIEW_FORMAT_LABELS,
  INTERVIEW_STATUS_COLORS,
  INTERVIEW_STATUS_LABELS,
  type InterviewRow,
} from '../schema'
import { formatInterviewTime } from '../utils/interview-time'

export interface InterviewCardProps {
  interview: InterviewRow
  applicantName: string
  /** The organization's zone, which HR reads every time in. */
  timeZone: string
  isCancelling: boolean
  onCancel: () => void
  onOfferNewTimes: () => void
}

export function InterviewCard({
  interview,
  applicantName,
  timeZone,
  isCancelling,
  onCancel,
  onOfferNewTimes,
}: InterviewCardProps) {
  const [confirming, confirm] = useDisclosure(false)
  const open = interview.status !== 'cancelled'
  const where =
    interview.format === 'onsite'
      ? interview.location
      : (interview.joinUrl ?? (interview.location || undefined))

  return (
    <Card withBorder padding="md" opacity={open ? undefined : 0.7}>
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Group gap="xs">
            <Badge color={INTERVIEW_STATUS_COLORS[interview.status]} variant="light">
              {INTERVIEW_STATUS_LABELS[interview.status]}
            </Badge>
            <Text size="sm">
              {INTERVIEW_FORMAT_LABELS[interview.format]} · {interview.durationMinutes} minutes
            </Text>
          </Group>
          {interview.inCalendar ? (
            <Badge variant="outline" color="gray" size="sm">
              In Outlook
            </Badge>
          ) : null}
        </Group>

        {interview.status === 'booked' && interview.bookedStart ? (
          <Stack gap={2}>
            <Text fw={600}>{formatInterviewTime(interview.bookedStart, timeZone)}</Text>
            {interview.applicantTimeZone && interview.applicantTimeZone !== timeZone ? (
              <Text size="xs" c="dimmed">
                For them: {formatInterviewTime(interview.bookedStart, interview.applicantTimeZone)}
              </Text>
            ) : null}
          </Stack>
        ) : null}

        {interview.status === 'offered' ? (
          interview.slots.length > 0 ? (
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                Offered, waiting for them to pick:
              </Text>
              <List size="sm" spacing={2}>
                {interview.slots.map((slot) => (
                  <List.Item key={slot.id}>{formatInterviewTime(slot.start, timeZone)}</List.Item>
                ))}
              </List>
            </Stack>
          ) : (
            <Text size="sm">Every time offered has passed without a pick. Offer new ones.</Text>
          )
        ) : null}

        {interview.status === 'reschedule_requested' ? (
          <Text size="sm">
            None of the times worked for {applicantName}. Offer new ones and they are asked again.
          </Text>
        ) : null}

        <Text size="sm" c="dimmed">
          With {interview.interviewers.map((person) => person.name).join(', ') || 'nobody yet'}
          {where ? (
            <>
              {' · '}
              {where.startsWith('http') ? (
                <Anchor href={where} target="_blank" rel="noopener" size="sm">
                  Join link
                </Anchor>
              ) : (
                where
              )}
            </>
          ) : null}
        </Text>

        {open ? (
          <Group gap="xs">
            {interview.status === 'booked' ? (
              <Button
                component={Link}
                href={interviewRoute(interview.id)}
                variant="light"
                size="compact-sm"
              >
                Open interview and scorecard
              </Button>
            ) : null}
            {interview.status !== 'booked' ? (
              <Button variant="light" size="compact-sm" onClick={onOfferNewTimes}>
                Offer new times
              </Button>
            ) : null}
            <Button variant="subtle" color="red" size="compact-sm" onClick={confirm.open}>
              Cancel interview
            </Button>
          </Group>
        ) : null}
      </Stack>

      <Modal
        opened={confirming}
        onClose={confirm.close}
        title={`Cancel the interview with ${applicantName}?`}
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            {interview.status === 'booked'
              ? 'Everyone invited is emailed that it is off, and it leaves their calendars.'
              : 'The times they were offered stop working. Nobody is emailed.'}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={confirm.close}>
              Keep it
            </Button>
            <Button
              color="red"
              loading={isCancelling}
              onClick={() => {
                onCancel()
                confirm.close()
              }}
            >
              Cancel interview
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}
