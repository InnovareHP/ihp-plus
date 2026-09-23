import { Badge } from '@mantine/core'
import { formatHours } from '@ihp/clock'
import type { CalendarDayState } from '../schema'

const LOOK: Record<Exclude<CalendarDayState, 'scheduled'>, { color: string; label: string }> = {
  worked: { color: 'green', label: 'Worked' },
  open: { color: 'green', label: 'Clocked in' },
  absent: { color: 'red', label: 'Absent' },
  leave: { color: 'cyan', label: 'On leave' },
  holiday: { color: 'grape', label: 'Holiday' },
  off: { color: 'gray', label: 'Day off' },
}

export interface CalendarStateBadgeProps {
  state: CalendarDayState
  workedSeconds: number
}

/** The caller's own day in words; a day still to come carries no badge, which is the quiet case. */
export function CalendarStateBadge({ state, workedSeconds }: CalendarStateBadgeProps) {
  if (state === 'scheduled') return null
  const look = LOOK[state]
  return (
    <Badge color={look.color} variant="light" size="sm">
      {state === 'worked' ? `${look.label} ${formatHours(workedSeconds)}` : look.label}
    </Badge>
  )
}
