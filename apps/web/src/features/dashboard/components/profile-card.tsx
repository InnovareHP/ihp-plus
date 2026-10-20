import { Card, Group, SimpleGrid, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export interface ProfileRow {
  label: string
  value: ReactNode
}

export interface ProfileCardProps {
  rows: readonly ProfileRow[]
  /** A line under the rows for the one thing the person may need to act on. */
  note?: ReactNode
}

// One description list replaces four tall cards that made the dashboard long on a phone.
export function ProfileCard({ rows, note }: ProfileCardProps) {
  return (
    <Card padding="lg">
      <SimpleGrid component="dl" cols={{ base: 1, sm: 2 }} spacing="xl" verticalSpacing="xs" m={0}>
        {rows.map((row) => (
          <Group key={row.label} justify="space-between" wrap="nowrap" gap="md">
            <Text component="dt" size="sm" c="dimmed">
              {row.label}
            </Text>
            <Text component="dd" size="sm" fw={500} ta="right" m={0} truncate>
              {row.value}
            </Text>
          </Group>
        ))}
      </SimpleGrid>
      {note ? (
        <Text size="sm" c="dimmed" mt="sm">
          {note}
        </Text>
      ) : null}
    </Card>
  )
}
