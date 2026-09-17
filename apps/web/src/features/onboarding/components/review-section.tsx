import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core'

interface ReviewSectionProps {
  title: string
  editLabel: string
  onEdit: () => void
  rows: readonly { label: string; value: string }[]
}

export function ReviewSection({ title, editLabel, onEdit, rows }: ReviewSectionProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" align="center" mb="sm">
        <Title order={3} size="h6">
          {title}
        </Title>
        <Button variant="subtle" size="compact-sm" onClick={onEdit} aria-label={editLabel}>
          Edit
        </Button>
      </Group>
      <Stack component="dl" gap="xs" m={0}>
        {rows.map((row) => (
          <Group key={row.label} gap="xs" align="baseline" wrap="wrap">
            <Text component="dt" size="sm" c="dimmed" miw={150}>
              {row.label}
            </Text>
            <Text component="dd" size="sm" m={0}>
              {row.value}
            </Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  )
}
