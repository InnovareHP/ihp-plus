'use client'

import { Anchor, Badge, Group, Paper, Stack, Text } from '@mantine/core'
import { IconFileText } from '@tabler/icons-react'
import { describeMoment } from '@/lib/relative-time'
import { OFFER_STATUS_COLORS, OFFER_STATUS_LABELS, type OfferRow } from '../schema'

const size = new Intl.NumberFormat('en-US', {
  style: 'unit',
  unit: 'kilobyte',
  maximumFractionDigits: 0,
})

export interface OfferCardProps {
  offer: OfferRow
  /** Where the letter downloads from; the route signs a fresh storage link per click. */
  letterHref: string | undefined
}

export function OfferCard({ offer, letterHref }: OfferCardProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Group justify="space-between" gap="xs" wrap="wrap">
          <Badge color={OFFER_STATUS_COLORS[offer.status]} variant="light">
            {OFFER_STATUS_LABELS[offer.status]}
          </Badge>
          <Text size="xs" c="dimmed">
            Sent by {offer.createdByName}, {describeMoment(offer.createdAt)}
          </Text>
        </Group>

        <Text size="sm" style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
          {offer.message}
        </Text>

        {offer.fileName && letterHref ? (
          <Group gap={6} wrap="nowrap">
            <IconFileText size={16} aria-hidden />
            <Anchor href={letterHref} size="sm" style={{ overflowWrap: 'anywhere' }}>
              {offer.fileName}
            </Anchor>
            {offer.fileSize ? (
              <Text size="xs" c="dimmed">
                {size.format(Math.max(1, Math.round(offer.fileSize / 1024)))}
              </Text>
            ) : null}
          </Group>
        ) : (
          <Text size="xs" c="dimmed">
            No letter attached.
          </Text>
        )}

        {offer.respondedAt ? (
          <Text size="sm">
            {offer.status === 'accepted' ? 'Accepted' : 'Declined'}{' '}
            {describeMoment(offer.respondedAt)}
            {offer.declineReason ? `: “${offer.declineReason}”` : '.'}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  )
}
