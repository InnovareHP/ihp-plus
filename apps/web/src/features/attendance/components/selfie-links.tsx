import { Anchor, Group, Text } from '@mantine/core'
import type { AttendanceDayRow } from '../schema'

/** The photos taken at each end, for the person themselves and for an admin. */
export function SelfieLinks({ day }: { day: AttendanceDayRow }) {
  if (!day.clockInSelfieUrl && !day.clockOutSelfieUrl) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    )
  }

  return (
    <Group gap="xs">
      {day.clockInSelfieUrl ? (
        <Anchor
          href={day.clockInSelfieUrl}
          target="_blank"
          rel="noreferrer"
          size="sm"
          aria-label={`Selfie taken clocking in on ${day.workDate}`}
        >
          In
        </Anchor>
      ) : null}
      {day.clockOutSelfieUrl ? (
        <Anchor
          href={day.clockOutSelfieUrl}
          target="_blank"
          rel="noreferrer"
          size="sm"
          aria-label={`Selfie taken clocking out on ${day.workDate}`}
        >
          Out
        </Anchor>
      ) : null}
    </Group>
  )
}
