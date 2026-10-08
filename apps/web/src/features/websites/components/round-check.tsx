'use client'

import { ActionIcon, Button, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconNote, IconRefresh } from '@tabler/icons-react'
import { formatTimeOfDay } from '@ihp/clock'
import { CHECK_ROUND_LABELS, type CheckRound, type WebsiteCheckRow } from '../schema'
import { describeReading } from '../utils/verdict'
import { CheckStatusBadge } from './check-status-badge'

export interface RoundCheckProps {
  round: CheckRound
  check: WebsiteCheckRow | undefined
  websiteName: string
  timeZone: string
  /** The IT lead, on today's list. */
  canAct: boolean
  isChecking: boolean
  onRecheck: () => void
  onVerdict: () => void
}

/** One end of the day for one site: what the probe read and what the lead made of it. */
export function RoundCheck({
  round,
  check,
  websiteName,
  timeZone,
  canAct,
  isChecking,
  onRecheck,
  onVerdict,
}: RoundCheckProps) {
  const label = CHECK_ROUND_LABELS[round]

  return (
    <Stack gap={6} miw={0}>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="sm" fw={600}>
          {label}
        </Text>
        {canAct ? (
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Check again">
              <ActionIcon
                variant="subtle"
                size="lg"
                loading={isChecking}
                aria-label={`Check ${websiteName} again for ${label.toLowerCase()}`}
                onClick={onRecheck}
              >
                <IconRefresh size={16} aria-hidden />
              </ActionIcon>
            </Tooltip>
            <Button
              variant="subtle"
              size="compact-sm"
              leftSection={<IconNote size={14} aria-hidden />}
              aria-label={`Mark ${websiteName} for ${label.toLowerCase()}`}
              onClick={onVerdict}
            >
              Mark
            </Button>
          </Group>
        ) : null}
      </Group>

      {check ? (
        <>
          <Group gap="xs" wrap="wrap">
            <CheckStatusBadge status={check.status} />
            <Text size="xs" c="dimmed">
              {describeReading(check)}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {formatTimeOfDay(check.checkedAt, timeZone)} · {check.checkedByName}
          </Text>
          {check.note ? (
            <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
              {check.note}
            </Text>
          ) : null}
        </>
      ) : (
        <Text size="sm" c="dimmed">
          Not checked yet
        </Text>
      )}
    </Stack>
  )
}
