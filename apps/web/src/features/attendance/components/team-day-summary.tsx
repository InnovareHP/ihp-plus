import { Badge, Stack, Text, UnstyledButton } from '@mantine/core'
import type { TeamCalendarDayRow } from '../schema'
import { teamCounts } from '../utils/calendar'

export interface TeamDaySummaryProps {
  day: TeamCalendarDayRow
  countryNames: ReadonlyMap<string, string>
  onOpen: (date: string) => void
}

const dayName = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

/** A team day in counts, as one button that opens the names behind them. */
export function TeamDaySummary({ day, countryNames, onOpen }: TeamDaySummaryProps) {
  const counts = teamCounts(day)
  const anything = counts.present + counts.absent + counts.leave > 0

  return (
    <Stack gap={4} align="flex-start">
      {day.holidays.map((holiday) => (
        <Text key={`${holiday.country}-${holiday.name}`} size="xs" fw={600}>
          {holiday.name}
          {holiday.country ? ` (${countryNames.get(holiday.country) ?? holiday.country})` : ''}
        </Text>
      ))}
      {anything ? (
        <UnstyledButton
          onClick={() => onOpen(day.date)}
          aria-label={`Who was in on ${dayName.format(new Date(`${day.date}T00:00:00Z`))}: ${counts.present} in, ${counts.absent} absent, ${counts.leave} on leave`}
        >
          <Stack gap={4} align="flex-start">
            {counts.present > 0 ? (
              <Badge color="green" variant="light" size="sm">
                {counts.present} in
              </Badge>
            ) : null}
            {counts.absent > 0 ? (
              <Badge color="red" variant="light" size="sm">
                {counts.absent} absent
              </Badge>
            ) : null}
            {counts.leave > 0 ? (
              <Badge color="cyan" variant="light" size="sm">
                {counts.leave} on leave
              </Badge>
            ) : null}
          </Stack>
        </UnstyledButton>
      ) : null}
    </Stack>
  )
}
