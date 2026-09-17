import { Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  description: ReactNode
  action?: ReactNode
}

// Empty states name the benefit and carry the control that fills them.
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Stack align="center" gap="xs" py="xl" px="md">
      <Text fw={600}>{title}</Text>
      <Text size="sm" c="dimmed" ta="center" maw="46ch">
        {description}
      </Text>
      {action ? <Group mt="xs">{action}</Group> : null}
    </Stack>
  )
}
