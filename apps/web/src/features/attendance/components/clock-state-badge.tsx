import { Badge } from '@mantine/core'
import type { AttendanceState } from '../schema'

const LOOK: Record<AttendanceState, { color: string; label: string }> = {
  in: { color: 'green', label: 'On the clock' },
  break: { color: 'yellow', label: 'On break' },
  out: { color: 'blue', label: 'Clocked out' },
  absent: { color: 'red', label: 'Absent' },
  leave: { color: 'cyan', label: 'On leave' },
  holiday: { color: 'grape', label: 'Holiday' },
  off: { color: 'gray', label: 'Day off' },
  expected: { color: 'gray', label: 'Not in yet' },
}

/** Colour is never the only signal: the state is spelled out in the badge itself. */
export function ClockStateBadge({ state }: { state: AttendanceState }) {
  const look = LOOK[state]
  return (
    <Badge color={look.color} variant="light">
      {look.label}
    </Badge>
  )
}
