import { Badge } from '@mantine/core'
import type { AttendanceState } from '../schema'

const LOOK: Record<AttendanceState, { color: string; label: string }> = {
  in: { color: 'green', label: 'On the clock' },
  break: { color: 'yellow', label: 'On break' },
  out: { color: 'blue', label: 'Clocked out' },
  absent: { color: 'gray', label: 'Not in' },
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
