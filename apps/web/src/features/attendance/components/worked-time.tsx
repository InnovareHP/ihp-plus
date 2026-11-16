import { Group, Stack, Text } from '@mantine/core'

export interface WorkedTimeProps {
  daysWorked: number
  hoursWorked: number
}

const hours = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** Days and hours as the timesheet counted them, shown and never typed. */
export function WorkedTime({ daysWorked, hoursWorked }: WorkedTimeProps) {
  return (
    <Group gap="xl" component="dl" m={0}>
      <Stack gap={0}>
        <Text component="dt" size="xs" c="dimmed">
          Days worked
        </Text>
        <Text component="dd" m={0} fw={600}>
          {daysWorked}
        </Text>
      </Stack>
      <Stack gap={0}>
        <Text component="dt" size="xs" c="dimmed">
          Hours worked
        </Text>
        <Text component="dd" m={0} fw={600}>
          {hours.format(hoursWorked)}
        </Text>
      </Stack>
    </Group>
  )
}
