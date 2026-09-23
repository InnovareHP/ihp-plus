import { Group, Stack, Text } from '@mantine/core'
import { formatHours } from '@ihp/clock'

export interface DayTotalsProps {
  workedSeconds: number
  breakSeconds: number
  lateSeconds: number
}

/** The three numbers a day is judged by, in the order people ask for them. */
export function DayTotals({ workedSeconds, breakSeconds, lateSeconds }: DayTotalsProps) {
  return (
    <Group gap="xl" component="dl" m={0}>
      <Total label="Worked" value={formatHours(workedSeconds)} />
      <Total label="Breaks" value={formatHours(breakSeconds)} />
      <Total label="Late" value={lateSeconds > 0 ? formatHours(lateSeconds) : 'On time'} />
    </Group>
  )
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text component="dt" size="xs" c="dimmed">
        {label}
      </Text>
      <Text component="dd" m={0} fw={600}>
        {value}
      </Text>
    </Stack>
  )
}
