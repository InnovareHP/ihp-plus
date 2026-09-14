import { Card, Group, Text } from '@mantine/core'
import type { ReactNode } from 'react'

const number = new Intl.NumberFormat('en-US')

export interface StatCardProps {
  label: string
  value: number
  hint: string
  /** A link that acts on the number, placed under the hint. */
  action?: ReactNode
}

export function StatCard({ label, value, hint, action }: StatCardProps) {
  return (
    <Card padding="lg">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fz={32} fw={700} lh={1.2}>
        {number.format(value)}
      </Text>
      <Text size="xs" c="dimmed">
        {hint}
      </Text>
      {action ? <Group mt="sm">{action}</Group> : null}
    </Card>
  )
}
