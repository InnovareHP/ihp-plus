import { Card, Text } from '@mantine/core'

const number = new Intl.NumberFormat('en-US')

export function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
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
    </Card>
  )
}
