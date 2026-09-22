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

  const manual = day.source === 'manual'

  return (
    <Badge color={day.status === 'approved' ? 'brand' : 'gray'} variant="light">
      {day.status === 'approved' ? 'Approved' : manual ? 'Entered by hand' : 'Recorded'}
    </Badge>
  )
}
