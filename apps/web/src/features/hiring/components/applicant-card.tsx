'use client'

import { Anchor, Button, Card, Group, Stack, Text } from '@mantine/core'
import { IconArrowRight, IconFileText } from '@tabler/icons-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import touch from '@/components/touch-target.module.css'
import { applicationRoute } from '@/lib/routes'
import { daysSince, type ApplicationSummary, type Stage } from '../schema'

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export interface ApplicantCardProps {
  application: ApplicationSummary
  /** The row's actions menu, supplied by the board. */
  actions: ReactNode
  /** The stage after this one; without it the card offers no one-tap move. */
  nextStage?: Stage
  onAdvance: (stage: Stage) => void
}

export function ApplicantCard({ application, actions, nextStage, onAdvance }: ApplicantCardProps) {
  const waiting = daysSince(application.stageChangedAt)

  return (
    <Card component="li" withBorder padding="sm" radius="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <Stack gap={2} miw={0}>
          <Anchor component={Link} href={applicationRoute(application.id)} fw={600} size="sm">
            {application.fullName}
          </Anchor>
          <Text size="xs" c="dimmed">
            Applied {dateOnly.format(new Date(application.createdAt))}
          </Text>
          <Group gap={6} wrap="nowrap">
            {/* Weight, not colour, marks someone left waiting a week, so it reads in both themes. */}
            <Text
              size="xs"
              c={waiting >= 7 ? undefined : 'dimmed'}
              fw={waiting >= 7 ? 600 : undefined}
            >
              {waiting === 0
                ? 'Moved here today'
                : `${waiting} ${waiting === 1 ? 'day' : 'days'} here`}
            </Text>
            {application.hasResume ? <IconFileText size={14} aria-label="Resume attached" /> : null}
          </Group>
        </Stack>
        {actions}
      </Group>
      {/* The commonest move one tap away, so a phone needs no trip through the menu. */}
      {nextStage ? (
        <Button
          variant="default"
          size="sm"
          className={touch.target}
          mt="xs"
          fullWidth
          rightSection={<IconArrowRight size={16} aria-hidden />}
          aria-label={`Move to ${nextStage.name}: ${application.fullName}`}
          onClick={() => onAdvance(nextStage)}
        >
          Move to {nextStage.name}
        </Button>
      ) : null}
    </Card>
  )
}
