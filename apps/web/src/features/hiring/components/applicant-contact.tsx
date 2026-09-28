'use client'

import { Anchor, Group, Stack, Text } from '@mantine/core'
import Link from 'next/link'
import { describeMoment } from '@/lib/relative-time'
import { postingRoute } from '@/lib/routes'
import type { ApplicationSummary } from '../schema'

export function ApplicantContact({ application }: { application: ApplicationSummary }) {
  const rows = [
    {
      label: 'Email',
      value: (
        <Anchor href={`mailto:${application.email}`} size="sm">
          {application.email}
        </Anchor>
      ),
    },
    {
      label: 'Phone',
      value: application.phone ? (
        <Anchor href={`tel:${application.phone}`} size="sm">
          {application.phone}
        </Anchor>
      ) : (
        <Text size="sm" c="dimmed">
          Not given
        </Text>
      ),
    },
    {
      label: 'Applied for',
      value: (
        <Anchor component={Link} href={postingRoute(application.postingId)} size="sm">
          {application.postingTitle}
        </Anchor>
      ),
    },
    { label: 'Applied', value: <Text size="sm">{describeMoment(application.createdAt)}</Text> },
  ]

  return (
    <Stack component="dl" gap="sm" m={0}>
      {rows.map((row) => (
        <Group key={row.label} gap="md" align="baseline" wrap="wrap">
          <Text component="dt" size="sm" c="dimmed" miw={120}>
            {row.label}
          </Text>
          <Text component="dd" size="sm" m={0}>
            {row.value}
          </Text>
        </Group>
      ))}
    </Stack>
  )
}
