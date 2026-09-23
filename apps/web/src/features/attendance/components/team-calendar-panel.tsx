'use client'

import { Card, Group, Select, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { useSchedules } from '../hooks/use-attendance-admin'
import { useCalendar, useCalendarParams, useTeamCalendar } from '../hooks/use-calendar'
import { useHolidayCountries } from '../hooks/use-holidays'
import { formatMonth, monthOf } from '../utils/calendar'
import { CalendarStates } from './calendar-states'
import { MonthNav } from './month-nav'
import { PersonMonth } from './person-month'
import { TeamDayModal } from './team-day-modal'
import { TeamMonth } from './team-month'

/** The admin's month: the whole team in counts, or one employee's days when one is picked. */
export function TeamCalendarPanel() {
  const { month: requested, userId, setMonth, setUserId } = useCalendarParams()
  const people = useSchedules()
  const team = useTeamCalendar(requested, !userId)
  const person = useCalendar(requested, userId, Boolean(userId))
  const countries = useHolidayCountries()
  const countryNames = new Map((countries.data ?? []).map((one) => [one.code, one.name]))
  // Which day's names are open is a disclosure nothing else needs to know about.
  const [openDate, setOpenDate] = useState<string | undefined>(undefined)

  const active = userId ? person : team
  const data = active.data
  const month = data?.month ?? requested
  const personName = people.data?.schedules.find((one) => one.userId === userId)?.userName

  return (
    <Card padding="lg" component="section" aria-labelledby="team-calendar-heading">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
          <Stack gap={2}>
            <Title order={2} size="h4" id="team-calendar-heading" aria-live="polite">
              {month ? formatMonth(month) : 'This month'}
            </Title>
            <Text size="xs" c="dimmed">
              {userId
                ? `${personName ?? 'This employee'}'s days, holidays and approved leave.`
                : 'Everyone at once. Pick a day to see who was in, absent or on leave.'}
            </Text>
          </Stack>
          <Group gap="sm" align="flex-end" wrap="wrap">
            <Select
              label="Employee"
              placeholder="Everyone"
              clearable
              searchable
              w={220}
              value={userId || null}
              data={(people.data?.schedules ?? []).map((one) => ({
                value: one.userId,
                label: one.userName,
              }))}
              onChange={(value) => setUserId(value ?? '')}
            />
            <MonthNav
              month={month}
              thisMonth={data ? monthOf(data.today) : ''}
              onChange={setMonth}
            />
          </Group>
        </Group>

        <CalendarStates
          isLoading={!data}
          errorMessage={active.isError && !data ? active.error.message : undefined}
          onRetry={() => void active.refetch()}
          isStale={active.isPlaceholderData}
        >
          {userId && person.data ? (
            <PersonMonth calendar={person.data} countryNames={countryNames} />
          ) : null}
          {!userId && team.data ? (
            <TeamMonth calendar={team.data} countryNames={countryNames} onOpenDay={setOpenDate} />
          ) : null}
        </CalendarStates>

        <TeamDayModal
          day={team.data?.days.find((day) => day.date === openDate)}
          onClose={() => setOpenDate(undefined)}
        />
      </Stack>
    </Card>
  )
}
