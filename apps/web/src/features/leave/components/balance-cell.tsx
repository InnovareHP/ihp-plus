import { Group, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { formatLeaveDays } from '../balance'
import type { LeaveBalance } from '../schema'

export interface BalanceCellProps {
  balance: LeaveBalance
}

export function BalanceCell({ balance }: BalanceCellProps) {
  const over = balance.remaining < 0
  return (
    <Group gap={4} wrap="nowrap">
      {over ? (
        <IconAlertTriangle size={16} aria-hidden="true" color="var(--mantine-color-red-6)" />
      ) : null}
      <Text size="sm" fw={500} c={over ? 'red' : undefined}>
        {over
          ? `${formatLeaveDays(-balance.remaining)} over`
          : `${balance.remaining} of ${balance.allowance} left`}
      </Text>
      {balance.overridden ? (
        <Text span size="xs" c="dimmed">
          (own)
        </Text>
      ) : null}
    </Group>
  )
}
