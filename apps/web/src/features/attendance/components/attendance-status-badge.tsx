import { Badge } from '@mantine/core'
import type { AttendanceDayRow } from '../schema'

/** What state the row is in, and whether anyone typed it rather than clocked it. */
export function AttendanceStatusBadge({ day }: { day: AttendanceDayRow }) {
  if (day.isOpen) {
    return (
      <Badge color="green" variant="light">
        Running
      </Badge>
    )
  }

  if (day.autoClosed) {
    return (
      <Badge color="orange" variant="light">
        Missed clock-out
      </Badge>
    )
  }

  return (
    <Badge color="gray" variant="light">
      {day.source === 'manual' ? 'Entered by hand' : 'Recorded'}
    </Badge>
  )
}
