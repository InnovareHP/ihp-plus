import { Box } from '@mantine/core'
import type { CalendarDayRow, CalendarMonth } from '../schema'
import { CalendarDayDetails } from './calendar-day-details'
import { DayCardList } from './day-card-list'
import { MonthGrid } from './month-grid'

export interface PersonMonthProps {
  calendar: CalendarMonth
  countryNames: ReadonlyMap<string, string>
}

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

/** One person's month: a grid on a wide screen, the notable days as a list on a phone. */
export function PersonMonth({ calendar, countryNames }: PersonMonthProps) {
  const byDate = new Map(calendar.days.map((day) => [day.date, day]))

  function renderDay(date: string) {
    const day = byDate.get(date)
    return day ? (
      <CalendarDayDetails
        day={day}
        countryNames={countryNames}
        showCountry={calendar.showsEveryone}
      />
    ) : null
  }

  return (
    <>
      <Box visibleFrom="sm">
        <MonthGrid
          month={calendar.month}
          today={calendar.today}
          renderDay={renderDay}
          isShaded={(date) => byDate.get(date)?.state === 'off'}
        />
      </Box>
      <Box hiddenFrom="sm">
        <DayCardList
          today={calendar.today}
          dates={calendar.days
            .filter((day) => worthListing(day, calendar.today))
            .map((day) => day.date)}
          renderDay={renderDay}
          empty="Nothing on this month: no holidays, no leave and no days clocked."
        />
      </Box>
    </>
  )
}
