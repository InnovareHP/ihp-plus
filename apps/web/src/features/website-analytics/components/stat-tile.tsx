import { Card, Group, Stack, Text } from '@mantine/core'
import { IconArrowDownRight, IconArrowUpRight, IconMinus } from '@tabler/icons-react'
import { formatChange } from '../format'

export interface StatTileProps {
  label: string
  value: string
  /** Change against the period before as a ratio; null when there is nothing to compare. */
  change?: number | null
  /** A short qualifier under the value, such as how many days a number covers. */
  note?: string
}

function ChangeLine({ change }: { change: number | null }) {
  if (change === null) {
    return <Text size="sm">No earlier data</Text>
  }
  const Icon = change > 0 ? IconArrowUpRight : change < 0 ? IconArrowDownRight : IconMinus
  // Direction is carried by the arrow and the sign in body text, never by a colour alone.
  return (
    <Group gap={4} wrap="nowrap">
      <Icon size={16} aria-hidden />
      <Text size="sm">{formatChange(change)} vs previous</Text>
    </Group>
  )
}

export function StatTile({ label, value, change, note }: StatTileProps) {
  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        <Text fz={28} fw={700} lh={1.2}>
          {value}
        </Text>
        {change === undefined ? null : <ChangeLine change={change} />}
        {note ? <Text size="sm">{note}</Text> : null}
      </Stack>
    </Card>
  )
}
