import { Stack, Text } from '@mantine/core'
import type { CalendarDayRow } from '../schema'
import { CalendarStateBadge } from './calendar-state-badge'

export interface CalendarDayDetailsProps {
  day: CalendarDayRow
  /** Country names by ISO code, shown where the viewer sees more than one country's days. */
  countryNames: ReadonlyMap<string, string>
  showCountry: boolean
  /** Leave beyond this many names folds into "+N more", so a busy day keeps its cell size. */
  maxLeave?: number
}

/** What a day holds: the viewer's own state, the holidays on it, and who is on leave. */
export function CalendarDayDetails({
  day,
  countryNames,
  showCountry,
  maxLeave = 3,
}: CalendarDayDetailsProps) {
  const shown = day.leave.slice(0, maxLeave)
  const hidden = day.leave.length - shown.length

  return (
    <Stack gap={4} align="flex-start">
      <CalendarStateBadge state={day.state} workedSeconds={day.workedSeconds} />
      {day.holidays.map((holiday) => (
        <Text key={`${holiday.country}-${holiday.name}`} size="xs" fw={600}>
          {holiday.name}
          {showCountry && holiday.country
            ? ` (${countryNames.get(holiday.country) ?? holiday.country})`
            : ''}
        </Text>
      ))}
      {shown.map((one) => (
        <Text key={one.userId} size="xs" c="dimmed">
          {one.userName}: {one.name}
        </Text>
      ))}
      {hidden > 0 ? (
        <Text size="xs" c="dimmed">
          +{hidden} more on leave
        </Text>
      ) : null}
    </Stack>
  )
}
