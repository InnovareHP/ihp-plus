'use client'

import { ActionIcon, Button, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconNote, IconRefresh } from '@tabler/icons-react'
import { formatTimeOfDay } from '@ihp/clock'
import { websiteSnapshotHref } from '@/lib/routes'
import { CHECK_ROUND_LABELS, type CheckRound, type WebsiteCheckRow } from '../schema'
import { snapshotStateOf } from '../utils/snapshot-state'
import { describeReading } from '../utils/verdict'
import { CheckStatusBadge } from './check-status-badge'
import { SnapshotThumb } from './snapshot-thumb'

export interface RoundCheckProps {
  round: CheckRound
  check: WebsiteCheckRow | undefined
  websiteId: string
  websiteName: string
  timeZone: string
  /** When today's picture for this round was taken, if one was. */
  snapshotAt: string | undefined
  /** Today's list with pictures switched on; otherwise no snapshot area at all. */
  showSnapshots: boolean
  /** When the list was last read, so a picture still on its way is told from a missing one. */
  now: number
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
  websiteId,
  websiteName,
  timeZone,
  snapshotAt,
  showSnapshots,
  now,
  canAct,
  isChecking,
  onRecheck,
  onVerdict,
}: RoundCheckProps) {
  const label = CHECK_ROUND_LABELS[round]
  const snapshot = snapshotStateOf({
    shown: showSnapshots,
    checkedAt: check?.checkedAt,
    snapshotAt,
    now,
  })

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
          {snapshot !== 'none' ? (
            <SnapshotThumb
              state={snapshot}
              websiteName={websiteName}
              roundLabel={label}
              thumbSrc={websiteSnapshotHref(websiteId, round, 'thumb', snapshotAt ?? '')}
              fullSrc={websiteSnapshotHref(websiteId, round, 'full', snapshotAt ?? '')}
              takenAt={snapshotAt ? formatTimeOfDay(snapshotAt, timeZone) : ''}
              canRetry={canAct}
            />
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
