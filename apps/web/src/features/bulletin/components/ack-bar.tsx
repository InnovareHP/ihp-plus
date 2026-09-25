'use client'

import { Button, Group, Paper, Text } from '@mantine/core'
import { IconChecks, IconCircleCheck } from '@tabler/icons-react'

export interface AckBarProps {
  acknowledgedByMe: boolean
  ackCount: number
  ackAudience: number
  /** The author is not asked to confirm their own post. */
  isAuthor: boolean
  canModerate: boolean
  disabled?: boolean
  onAcknowledge: () => void
  onShowStatus: () => void
}

export function AckBar({
  acknowledgedByMe,
  ackCount,
  ackAudience,
  isAuthor,
  canModerate,
  disabled,
  onAcknowledge,
  onShowStatus,
}: AckBarProps) {
  return (
    <Paper radius="md" p="sm" bg="var(--mantine-primary-color-light)">
      <Group justify="space-between" gap="sm" wrap="wrap">
        {isAuthor ? (
          <Text size="sm">You asked everyone to confirm they have read this.</Text>
        ) : acknowledgedByMe ? (
          <Group gap={6} wrap="nowrap">
            <IconCircleCheck size={18} aria-hidden />
            <Text size="sm" fw={500}>
              You confirmed you read this.
            </Text>
          </Group>
        ) : (
          <Group gap="sm" wrap="wrap">
            <Text size="sm">Please confirm you have read this.</Text>
            <Button
              size="compact-md"
              leftSection={<IconChecks size={16} aria-hidden />}
              disabled={disabled}
              onClick={onAcknowledge}
            >
              I have read this
            </Button>
          </Group>
        )}

        {canModerate ? (
          <Button variant="subtle" size="compact-sm" disabled={disabled} onClick={onShowStatus}>
            {ackCount} of {ackAudience} confirmed
          </Button>
        ) : null}
      </Group>
    </Paper>
  )
}
