import { Anchor, Button, Group, Stack, Text } from '@mantine/core'
import { IconPlayerStop } from '@tabler/icons-react'
import Link from 'next/link'
import { formatElapsed, formatTimeOfDay } from '@ihp/clock'
import { routes } from '@/lib/routes'
import type { AttendanceDayRow } from '../schema'
import { liveWorkedSeconds } from '../utils/day'
import { ClockStatusIcon } from './clock-status-icon'

export interface ClockActivityProps {
  day: AttendanceDayRow
  now: number
  timeZone: string
  onClockOut: () => void
  onNavigate?: () => void
}

export function ClockActivity({ day, now, timeZone, onClockOut, onNavigate }: ClockActivityProps) {
  return (
    <Stack gap={6}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap={6} wrap="nowrap">
          <ClockStatusIcon onBreak={day.onBreak} />
          <Text size="sm" fw={600}>
            {day.onBreak ? 'On break' : 'On the clock'}
          </Text>
        </Group>
        <Text size="sm" ff="monospace" fw={500}>
          {formatElapsed(liveWorkedSeconds(day, now))}
        </Text>
      </Group>
      <Text size="xs" c="dimmed">
        Clocked in at {formatTimeOfDay(day.clockInAt, timeZone)}
      </Text>
      <Group justify="space-between" wrap="nowrap" mt={4}>
        <Anchor component={Link} href={routes.attendance} size="sm" onClick={onNavigate}>
          Open time clock
        </Anchor>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconPlayerStop size={14} aria-hidden />}
          onClick={onClockOut}
        >
          Clock out
        </Button>
      </Group>
    </Stack>
  )
}
