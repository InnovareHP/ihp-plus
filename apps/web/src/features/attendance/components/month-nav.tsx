import { ActionIcon, Button, Group } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { shiftMonth } from '../utils/calendar'

export interface MonthNavProps {
  /** The month on screen; empty until the server has said which month "this month" is. */
  month: string
  thisMonth: string
  onChange: (month: string) => void
}

/** Previous, this month, next — "this month" clears the URL so a link always means now. */
export function MonthNav({ month, thisMonth, onChange }: MonthNavProps) {
  return (
    <Group gap="xs">
      <ActionIcon
        variant="default"
        size="lg"
        aria-label="Previous month"
        disabled={!month}
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <IconChevronLeft size={18} aria-hidden />
      </ActionIcon>
      <Button
        variant="default"
        disabled={!month || month === thisMonth}
        onClick={() => onChange('')}
      >
        This month
      </Button>
      <ActionIcon
        variant="default"
        size="lg"
        aria-label="Next month"
        disabled={!month}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <IconChevronRight size={18} aria-hidden />
      </ActionIcon>
    </Group>
  )
}
