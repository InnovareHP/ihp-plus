'use client'

import { Badge, Button, Group, Stack, Text } from '@mantine/core'
import type { ClientAccessRow as AccessRow } from '../schema'

export interface ClientAccessRowProps {
  row: AccessRow
  isPending: boolean
  onRevoke: (row: AccessRow) => void
}

const stamp = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export function ClientAccessRow({ row, isPending, onRevoke }: ClientAccessRowProps) {
  const revoked = Boolean(row.revokedAt)

  return (
    <Group justify="space-between" wrap="nowrap" align="center" gap="sm">
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text size="sm" fw={500} truncate>
          {row.email}
        </Text>
        <Text size="xs" c="dimmed">
          {revoked
            ? `Access removed ${stamp.format(new Date(row.revokedAt ?? row.invitedAt))}`
            : `Can read since ${stamp.format(new Date(row.invitedAt))}`}
        </Text>
      </Stack>

      {revoked ? (
        // Colour alone never carries the state, so it is spelled out as well.
        <Badge color="gray" variant="light">
          Removed
        </Badge>
      ) : (
        <Button
          variant="subtle"
          color="red"
          size="compact-sm"
          disabled={isPending}
          onClick={() => onRevoke(row)}
        >
          Remove access
        </Button>
      )}
    </Group>
  )
}
