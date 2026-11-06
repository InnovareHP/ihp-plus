import { Box, Group, Text } from '@mantine/core'
import { CHECK_STATUS_COLORS, CHECK_STATUS_LABELS, type WebsiteCheckRow } from '../schema'
import { formatTime } from '../utils/day-report'

export interface CheckStatusTextProps {
  check: WebsiteCheckRow | undefined
  timeZone: string
}

// The word carries the status; the dot only helps the eye scan a column.
export function CheckStatusText({ check, timeZone }: CheckStatusTextProps) {
  if (!check) {
    return (
      <Text size="sm" c="dimmed">
        Not checked
      </Text>
    )
  }
  return (
    <Group gap={6} wrap="nowrap">
      <Box
        component="span"
        w={8}
        h={8}
        bg={`${CHECK_STATUS_COLORS[check.status]}.6`}
        style={{ borderRadius: '50%', flexShrink: 0 }}
        aria-hidden
      />
      <Text size="sm" fw={check.status === 'up' ? 400 : 600}>
        {CHECK_STATUS_LABELS[check.status]}
      </Text>
      <Text size="xs" c="dimmed">
        {formatTime(check.checkedAt, timeZone)}
      </Text>
    </Group>
  )
}
