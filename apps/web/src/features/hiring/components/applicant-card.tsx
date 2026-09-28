'use client'

import { Anchor, Card, Group, Stack, Text } from '@mantine/core'
import { IconFileText } from '@tabler/icons-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { applicationRoute } from '@/lib/routes'
import { daysSince, type ApplicationSummary } from '../schema'

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export interface ApplicantCardProps {
  application: ApplicationSummary
  /** The row's actions menu, supplied by the board. */
  actions: ReactNode
}

export function ApplicantCard({ application, actions }: ApplicantCardProps) {
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
    </Card>
  )
}
