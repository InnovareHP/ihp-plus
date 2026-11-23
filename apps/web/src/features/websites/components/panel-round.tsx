'use client'

import { ActionIcon, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconClockEdit, IconRefresh } from '@tabler/icons-react'
import { websiteSnapshotHref } from '@/lib/routes'
import { CHECK_ROUND_LABELS, type CheckRound, type WebsiteCheckRow } from '../schema'
import { formatTime } from '../utils/day-report'
import { snapshotStateOf } from '../utils/snapshot-state'
import { describeReading, isOverridden } from '../utils/verdict'
import { CheckStatusBadge } from './check-status-badge'
import { SnapshotThumb } from './snapshot-thumb'

export interface PanelRoundProps {
  round: CheckRound
  check: WebsiteCheckRow | undefined
  websiteId: string
  websiteName: string
  timeZone: string
  snapshotAt: string | undefined
  showSnapshots: boolean
  now: number
  canAct: boolean
  isChecking: boolean
  /** An admin, who may correct when the check ran. */
  canEditTime: boolean
  onRecheck: () => void
  onEditTime: () => void
}

/** What the automatic check found at one end of the shift, with its picture. */
export function PanelRound({
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
  canEditTime,
  onRecheck,
  onEditTime,
}: PanelRoundProps) {
  const label = CHECK_ROUND_LABELS[round]
  const snapshot = snapshotStateOf({
    shown: showSnapshots,
    checkedAt: check?.checkedAt,
    snapshotAt,
    now,
  })

  return (
    <Stack gap={6}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap="sm" wrap="wrap">
          <Text size="sm" fw={600} w={64}>
            {label}
          </Text>
          {check ? (
            <CheckStatusBadge status={check.status} />
          ) : (
            <Text size="sm" c="dimmed">
              Not checked yet
            </Text>
          )}
        </Group>
        <Group gap={0} wrap="nowrap">
          {canEditTime && check ? (
            <Tooltip label="Edit time">
              <ActionIcon
                variant="subtle"
                size={44}
                aria-label={`Edit when ${websiteName} was checked for ${label.toLowerCase()}`}
                onClick={onEditTime}
              >
                <IconClockEdit size={18} aria-hidden />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {canAct ? (
            <Tooltip label="Check again">
              <ActionIcon
                variant="subtle"
                size={44}
                loading={isChecking}
                aria-label={`Check ${websiteName} again for ${label.toLowerCase()}`}
                onClick={onRecheck}
              >
                <IconRefresh size={18} aria-hidden />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Group>
      </Group>
      {check ? (
        <Text size="xs" c="dimmed">
          {formatTime(check.checkedAt, timeZone)} · {describeReading(check)}
          {isOverridden(check) ? ` · status set by ${check.checkedByName}` : ''}
        </Text>
      ) : null}
      {check?.note ? (
        <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
          {check.note}
        </Text>
      ) : null}
      {check && snapshot !== 'none' ? (
        <SnapshotThumb
          state={snapshot}
          websiteName={websiteName}
          roundLabel={label}
          thumbSrc={websiteSnapshotHref(websiteId, round, 'thumb', snapshotAt ?? '')}
          fullSrc={websiteSnapshotHref(websiteId, round, 'full', snapshotAt ?? '')}
          takenAt={snapshotAt ? formatTime(snapshotAt, timeZone) : ''}
          canRetry={canAct}
        />
      ) : null}
    </Stack>
  )
}
