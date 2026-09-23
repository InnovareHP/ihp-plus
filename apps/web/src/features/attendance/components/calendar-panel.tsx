'use client'

import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useCalendar, useCalendarMonth } from '../hooks/use-calendar'
import { useHolidayCountries } from '../hooks/use-holidays'
import { formatMonth, monthOf, shiftMonth } from '../utils/calendar'
import { CalendarDayList } from './calendar-day-list'
import { MonthGrid } from './month-grid'

/** One month of the viewer's days, the holidays that apply to them, and the leave around them. */
export function CalendarPanel() {
  const { month: requested, setMonth } = useCalendarMonth()
  const calendar = useCalendar(requested)
  const data = calendar.data
  // Country names only matter to an admin, who sees more than one country's holidays.
  const countries = useHolidayCountries()
  const countryNames = new Map((countries.data ?? []).map((one) => [one.code, one.name]))

  const month = data?.month ?? requested
  const thisMonth = data ? monthOf(data.today) : ''

  return (
    <Card padding="lg" component="section" aria-labelledby="calendar-heading">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Stack gap={2}>
            <Title order={2} size="h4" id="calendar-heading" aria-live="polite">
              {month ? formatMonth(month) : 'This month'}
            </Title>
            <Text size="xs" c="dimmed">
              {data?.canManage
                ? `Every holiday and everyone's leave, in the company zone${data ? `, ${data.timeZone}` : ''}.`
                : 'Your days, your holidays and your approved leave.'}
            </Text>
          </Stack>
          <Group gap="xs">
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Previous month"
              disabled={!month}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <IconChevronLeft size={18} aria-hidden />
            </ActionIcon>
            <Button
              variant="default"
              disabled={!data || month === thisMonth}
              onClick={() => setMonth('')}
            >
              This month
            </Button>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Next month"
              disabled={!month}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <IconChevronRight size={18} aria-hidden />
            </ActionIcon>
          </Group>
        </Group>

        {calendar.isError && !data ? (
          <Alert color="red" variant="light" title="Could not load the calendar" role="alert">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{calendar.error.message}</Text>
              <Button size="sm" variant="light" color="red" onClick={() => void calendar.refetch()}>
                Try again
              </Button>
            </Stack>
          </Alert>
        ) : !data ? (
          <Stack gap="xs" aria-busy="true">
            <Skeleton height={36} />
            {[0, 1, 2, 3, 4].map((week) => (
              <Skeleton key={week} height={116} />
            ))}
          </Stack>
        ) : (
          // A page change keeps the old month on screen, dimmed, until the new one lands.
          <Box opacity={calendar.isPlaceholderData ? 0.6 : 1}>
            <Box visibleFrom="sm">
              <MonthGrid
                month={data.month}
                today={data.today}
                days={data.days}
                countryNames={countryNames}
                showCountry={data.canManage}
              />
            </Box>
            <Box hiddenFrom="sm">
              <CalendarDayList
                today={data.today}
                days={data.days}
                countryNames={countryNames}
                showCountry={data.canManage}
              />
            </Box>
          </Box>
        )}
      </Stack>
    </Card>
  )
}
