import { Badge, Card, Group, Stack, Text } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'

export interface LockedQuestionCardProps {
  index: number
  label: string
  help: string
}

/** A question the form's purpose depends on, shown so the admin knows it is asked. */
export function LockedQuestionCard({ index, label, help }: LockedQuestionCardProps) {
  return (
    <Card
      padding="md"
      bd="1px solid var(--mantine-color-default-border)"
      bg="var(--mantine-color-default-hover)"
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            Question {index + 1}: {label}
          </Text>
          <Text size="xs" c="dimmed">
            {help || 'A date.'} Part of every time off form, so it cannot be changed or removed.
          </Text>
        </Stack>
        <Group gap={6} wrap="nowrap">
          <Badge variant="light" color="gray">
            Date · required
          </Badge>
          <IconLock size={16} aria-hidden />
        </Group>
      </Group>
    </Card>
  )
}
