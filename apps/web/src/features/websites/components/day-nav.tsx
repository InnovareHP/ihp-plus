'use client'

import { ActionIcon, Button, Group, Text } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { shiftDateKey } from '@ihp/clock'

const dayTitle = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatDay(dateKey: string) {
  return dayTitle.format(new Date(`${dateKey}T00:00:00Z`))
}

export interface DayNavProps {
  date: string
  today: string
  onChange: (date: string) => void
}

/** Previous day, today, next — "today" clears the URL so a link always means now. */
export function DayNav({ date, today, onChange }: DayNavProps) {
  const isToday = date === today
  return (
    <Group gap="xs" wrap="nowrap">
      <ActionIcon
        variant="default"
        size="lg"
        aria-label="Previous day"
        onClick={() => onChange(shiftDateKey(date, -1))}
      >
        <IconChevronLeft size={18} aria-hidden />
      </ActionIcon>
      <Text fw={600} miw={130} ta="center" aria-live="polite">
        {formatDay(date)}
      </Text>
      <ActionIcon
        variant="default"
        size="lg"
        aria-label="Next day"
        disabled={isToday}
        onClick={() => onChange(shiftDateKey(date, 1))}
      >
        <IconChevronRight size={18} aria-hidden />
      </ActionIcon>
      <Button variant="default" disabled={isToday} onClick={() => onChange('')}>
        Today
      </Button>
    </Group>
  )
}
