import { Card, Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export interface DayCardListProps {
  today: string
  /** Only the days worth listing; the caller decides which those are. */
  dates: readonly string[]
  renderDay: (date: string) => ReactNode
  empty: string
}

const dayLabel = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** A month on a phone: the days with something on them, as a list rather than a squeezed grid. */
export function DayCardList({ today, dates, renderDay, empty }: DayCardListProps) {
  if (dates.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {empty}
      </Text>
    )
  }

  return (
    <Stack component="ul" gap="xs" p={0} m={0} style={{ listStyle: 'none' }}>
      {dates.map((date) => (
        <Card
          key={date}
          component="li"
          padding="sm"
          withBorder
          aria-current={date === today ? 'date' : undefined}
        >
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            <Text size="sm" fw={date === today ? 700 : 500} miw={96}>
              {dayLabel.format(new Date(`${date}T00:00:00Z`))}
              {date === today ? ' · Today' : ''}
            </Text>
            {renderDay(date)}
          </Group>
        </Card>
      ))}
    </Stack>
  )
}
