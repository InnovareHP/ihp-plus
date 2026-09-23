import { Alert, Text } from '@mantine/core'
import { IconBeach } from '@tabler/icons-react'

export interface DayOffNoticeProps {
  holidayName: string | undefined
  leaveName: string | undefined
}

/** Says why nobody expects a clock-in today, without taking the button away. */
export function DayOffNotice({ holidayName, leaveName }: DayOffNoticeProps) {
  // Leave is the person's own, so it is the more specific thing to say.
  const reason = leaveName
    ? `You are on approved leave today (${leaveName}).`
    : `Today is ${holidayName}, a company holiday.`

  return (
    <Alert color="blue" variant="light" icon={<IconBeach size={18} aria-hidden />}>
      <Text size="sm">{reason} Clock in only if you are working it.</Text>
    </Alert>
  )
}
