'use client'

import { Card, Group, Stack, Text, Title } from '@mantine/core'
import { useCalendar, useCalendarParams } from '../hooks/use-calendar'
import { useHolidayCountries } from '../hooks/use-holidays'
import { formatMonth, monthOf } from '../utils/calendar'
import { CalendarStates } from './calendar-states'
import { MonthNav } from './month-nav'
import { PersonMonth } from './person-month'

/** One month of the viewer's days, the holidays that apply to them, and the leave around them. */
export function CalendarPanel() {
  const { month: requested, setMonth } = useCalendarParams()
  const calendar = useCalendar(requested)
  const data = calendar.data
  // Country names only matter to an admin, who sees more than one country's holidays.
  const countries = useHolidayCountries()
  const countryNames = new Map((countries.data ?? []).map((one) => [one.code, one.name]))

  const month = data?.month ?? requested

  return (
    <Card padding="lg" component="section" aria-labelledby="calendar-heading">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Stack gap={2}>
            <Title order={2} size="h4" id="calendar-heading" aria-live="polite">
              {month ? formatMonth(month) : 'This month'}
            </Title>
            <Text size="xs" c="dimmed">
              {data?.showsEveryone
                ? `Every holiday and everyone's leave, in the company zone, ${data.timeZone}.`
                : 'Your days, your holidays and your approved leave.'}
            </Text>
          </Stack>
          <MonthNav month={month} thisMonth={data ? monthOf(data.today) : ''} onChange={setMonth} />
        </Group>

        <CalendarStates
          isLoading={!data}
          errorMessage={calendar.isError && !data ? calendar.error.message : undefined}
          onRetry={() => void calendar.refetch()}
          isStale={calendar.isPlaceholderData}
        >
          {data ? <PersonMonth calendar={data} countryNames={countryNames} /> : null}
        </CalendarStates>
      </Stack>
    </Card>
  )
}
