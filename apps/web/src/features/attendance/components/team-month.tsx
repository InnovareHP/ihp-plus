import { Box } from '@mantine/core'
import type { TeamCalendarMonth } from '../schema'
import { DayCardList } from './day-card-list'
import { MonthGrid } from './month-grid'
import { TeamDaySummary } from './team-day-summary'

export interface TeamMonthProps {
  calendar: TeamCalendarMonth
  countryNames: ReadonlyMap<string, string>
  onOpenDay: (date: string) => void
}

/** The whole team's month in counts: a grid on a wide screen, the busy days as a list on a phone. */
export function TeamMonth({ calendar, countryNames, onOpenDay }: TeamMonthProps) {
  const byDate = new Map(calendar.days.map((day) => [day.date, day]))

  function renderDay(date: string) {
    const day = byDate.get(date)
    return day ? <TeamDaySummary day={day} countryNames={countryNames} onOpen={onOpenDay} /> : null
  }

  return (
    <>
      <Box visibleFrom="sm">
        <MonthGrid
          month={calendar.month}
          today={calendar.today}
          renderDay={renderDay}
          // Nobody expected in and no holiday: the day is somebody's weekend, so it fades back.
          isShaded={(date) => {
            const day = byDate.get(date)
            return !day || (day.people.length === 0 && day.holidays.length === 0)
          }}
        />
      </Box>
      <Box hiddenFrom="sm">
        <DayCardList
          today={calendar.today}
          dates={calendar.days
            .filter(
              (day) =>
                day.date === calendar.today || day.people.length > 0 || day.holidays.length > 0,
            )
            .map((day) => day.date)}
          renderDay={renderDay}
          empty="Nothing on this month yet: nobody has clocked in, been absent or taken leave."
        />
      </Box>
    </>
  )
}
