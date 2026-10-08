'use client'

import {
  Anchor,
  Card,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  Title,
  VisuallyHidden,
} from '@mantine/core'
import { IconArchive, IconExternalLink, IconPencil } from '@tabler/icons-react'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { CHECK_ROUNDS, type CheckRound, type WebsiteRow } from '../schema'
import { RoundCheck } from './round-check'

export interface WebsiteCardProps {
  website: WebsiteRow
  timeZone: string
  canCheck: boolean
  canManage: boolean
  /** Which round of this site is being re-read right now, if any. */
  checkingRound: CheckRound | undefined
  onRecheck: (round: CheckRound) => void
  onVerdict: (round: CheckRound) => void
  onEdit: () => void
  onArchive: () => void
}

export function WebsiteCard({
  website,
  timeZone,
  canCheck,
  canManage,
  checkingRound,
  onRecheck,
  onVerdict,
  onEdit,
  onArchive,
}: WebsiteCardProps) {
  return (
    <Card component="li" withBorder padding="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" mb="sm">
        <Stack gap={2} miw={0}>
          <Title order={3} size="h5">
            {website.name}
          </Title>
          <Anchor
            href={website.url}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            style={{ overflowWrap: 'anywhere' }}
          >
            {website.url} <IconExternalLink size={12} aria-hidden />
            <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
          </Anchor>
          <Text size="xs" c="dimmed">
            {website.clientName ? `Client: ${website.clientName}` : 'No client linked'}
          </Text>
        </Stack>
        {canManage ? (
          <RowActionsMenu name={website.name}>
            <Menu.Item leftSection={<IconPencil size={14} aria-hidden />} onClick={onEdit}>
              Edit website
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconArchive size={14} aria-hidden />}
              onClick={onArchive}
            >
              Remove from list
            </Menu.Item>
          </RowActionsMenu>
        ) : null}
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
        {CHECK_ROUNDS.map((round) => (
          <RoundCheck
            key={round}
            round={round}
            check={website.checks[round]}
            websiteName={website.name}
            timeZone={timeZone}
            canAct={canCheck}
            isChecking={checkingRound === round}
            onRecheck={() => onRecheck(round)}
            onVerdict={() => onVerdict(round)}
          />
        ))}
      </SimpleGrid>
    </Card>
  )
}
