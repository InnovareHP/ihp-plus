import { Card, Group, Stack, Text } from '@mantine/core'
import type { CalendarDayRow } from '../schema'
import { CalendarDayDetails } from './calendar-day-details'

export interface CalendarDayListProps {
  today: string
  days: readonly CalendarDayRow[]
  countryNames: ReadonlyMap<string, string>
  showCountry: boolean
}

const dayLabel = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

// A plain upcoming workday has nothing to say, so the narrow view lists only days that do.
function worthListing(day: CalendarDayRow, today: string) {
  return (
    day.date === today ||
    day.holidays.length > 0 ||
    day.leave.length > 0 ||
    day.state === 'absent' ||
    day.state === 'worked' ||
    day.state === 'open'
  )
}

/** The month on a phone: the days with something on them, as a list rather than a squeezed grid. */
export function CalendarDayList({ today, days, countryNames, showCountry }: CalendarDayListProps) {
  const listed = days.filter((day) => worthListing(day, today))

  if (listed.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nothing on this month: no holidays, no leave and no days clocked.
      </Text>
    )
  }

  return (
    <Stack component="ul" gap="xs" p={0} m={0} style={{ listStyle: 'none' }}>
      {listed.map((day) => (
        <Card
          key={day.date}
          component="li"
          padding="sm"
          withBorder
          aria-current={day.date === today ? 'date' : undefined}
        >
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            <Text size="sm" fw={day.date === today ? 700 : 500} miw={96}>
              {dayLabel.format(new Date(`${day.date}T00:00:00Z`))}
              {day.date === today ? ' · Today' : ''}
            </Text>
            <CalendarDayDetails
              day={day}
              countryNames={countryNames}
              showCountry={showCountry}
              maxLeave={10}
            />
          </Group>
        </Card>
      ))}
    </Stack>
  )
}
