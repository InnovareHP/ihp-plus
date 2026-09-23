import { Table, Text, VisuallyHidden } from '@mantine/core'
import { WEEKDAY_LABELS } from '@ihp/clock'
import type { ReactNode } from 'react'
import { formatMonth, weeksOfMonth } from '../utils/calendar'

export interface MonthGridProps {
  month: string
  today: string
  /** What a day's cell holds under its date. */
  renderDay: (date: string) => ReactNode
  /** Days that are nobody's working day, shaded so the working week stands out. */
  isShaded?: (date: string) => boolean
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

const fullDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

const SHADE = 'var(--mantine-color-default-hover)'

/** The month as a real table: a screen reader walks it by weekday column and week row. */
export function MonthGrid({ month, today, renderDay, isShaded }: MonthGridProps) {
  return (
    <Table withTableBorder withColumnBorders layout="fixed" verticalSpacing="xs">
      <Table.Caption>{formatMonth(month)}</Table.Caption>
      <Table.Thead>
        <Table.Tr>
          {WEEKDAY_LABELS.map((label, index) => (
            <Table.Th key={label} scope="col" ta="center">
              <abbr title={WEEKDAY_NAMES[index]}>{label}</abbr>
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {weeksOfMonth(month).map((week) => (
          <Table.Tr key={week.find(Boolean) ?? month}>
            {week.map((date, index) => {
              if (!date) return <Table.Td key={`pad-${index}`} bg={SHADE} />
              const isToday = date === today
              return (
                <Table.Td
                  key={date}
                  h={116}
                  // Cells hold a stack of notes, so they read from the top rather than the middle.
                  style={{ verticalAlign: 'top' }}
                  bg={isShaded?.(date) ? SHADE : undefined}
                  aria-current={isToday ? 'date' : undefined}
                >
                  <Text
                    size="sm"
                    fw={isToday ? 700 : 500}
                    c={isToday ? 'brand' : undefined}
                    mb={4}
                    aria-hidden
                  >
                    {Number(date.slice(8))}
                    {isToday ? ' · Today' : ''}
                  </Text>
                  <VisuallyHidden>
                    {fullDate.format(new Date(`${date}T00:00:00Z`))}
                    {isToday ? ', today' : ''}
                  </VisuallyHidden>
                  {renderDay(date)}
                </Table.Td>
              )
            })}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
