import { Alert, Text } from '@mantine/core'
import { IconBeach } from '@tabler/icons-react'

export interface DayOffNoticeProps {
  holidayName: string
}

/** Says why nobody expects a clock-in today, without taking the button away. */
export function DayOffNotice({ holidayName }: DayOffNoticeProps) {
  return (
    <Alert color="blue" variant="light" icon={<IconBeach size={18} aria-hidden />}>
      <Text size="sm">
        Today is {holidayName}, a company holiday. Clock in only if you are working it.
      </Text>
    </Alert>
  )
}
