import { Card, Group, Stack, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export interface SummaryCardProps {
  title: string
  badge?: ReactNode
  children: ReactNode
}

export function SummaryCard({ title, badge, children }: SummaryCardProps) {
  return (
    <Card padding="lg">
      <Group justify="space-between" align="center" mb="xs" wrap="nowrap">
        <Title order={3} size="h6">
          {title}
        </Title>
        {badge}
      </Group>
      <Stack gap={4}>{children}</Stack>
    </Card>
  )
}
