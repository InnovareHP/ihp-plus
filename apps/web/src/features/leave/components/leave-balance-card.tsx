import { Badge, Card, Group, Progress, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { formatLeaveDays } from '../balance'
import type { LeaveBalance } from '../schema'

export interface LeaveBalanceCardProps {
  balance: LeaveBalance
}

export function LeaveBalanceCard({ balance }: LeaveBalanceCardProps) {
  const over = balance.remaining < 0
  const usedShare =
    balance.allowance > 0 ? Math.min(balance.used / balance.allowance, 1) * 100 : over ? 100 : 0

  return (
    <Card padding="lg" component="article" aria-label={balance.formName}>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Text size="sm" c="dimmed" fw={500}>
            {balance.formName}
          </Text>
          {balance.overridden ? (
            <Badge variant="light" size="sm">
              Your own allowance
            </Badge>
          ) : null}
        </Group>
        {over ? (
          <Group gap={6} wrap="nowrap">
            <IconAlertTriangle size={22} aria-hidden="true" color="var(--mantine-color-red-6)" />
            <Text fz={28} fw={700} lh={1.2} c="red">
              {formatLeaveDays(-balance.remaining)} over
            </Text>
          </Group>
        ) : (
          <Text fz={28} fw={700} lh={1.2}>
            {formatLeaveDays(balance.remaining)} left
          </Text>
        )}
        <Progress
          value={usedShare}
          color={over ? 'red' : undefined}
          aria-label={`${balance.formName}: ${balance.used} of ${balance.allowance} days used`}
        />
        <Text size="xs" c="dimmed">
          {balance.used} used of {formatLeaveDays(balance.allowance)}
          {balance.pending > 0 ? ` · ${balance.pending} waiting for approval` : ''}
        </Text>
      </Stack>
    </Card>
  )
}
