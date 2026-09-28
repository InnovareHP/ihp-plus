'use client'

import { Anchor, Card, Stack, Text, Title } from '@mantine/core'
import Link from 'next/link'
import { careersPostingRoute } from '@/lib/routes'
import type { PublicPosting } from '../schema'
import { PostingMeta } from './posting-meta'

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

// A client leaf only because a server component cannot hand next/link to a Mantine component.
export function CareersPostingCard({ posting }: { posting: PublicPosting }) {
  return (
    <Card component="article" withBorder padding="lg">
      <Stack gap="sm">
        <Title order={2} size="h4">
          <Anchor component={Link} href={careersPostingRoute(posting.slug)} inherit>
            {posting.title}
          </Anchor>
        </Title>
        <PostingMeta {...posting} />
        {posting.summary ? <Text size="sm">{posting.summary}</Text> : null}
        {posting.closesAt ? (
          <Text size="xs" c="dimmed">
            Applications close {dateOnly.format(new Date(posting.closesAt))}
          </Text>
        ) : null}
      </Stack>
    </Card>
  )
}
