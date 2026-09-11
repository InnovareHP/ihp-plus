import { Card, Group, Stack, Text } from '@mantine/core'
import { IconFilePlus } from '@tabler/icons-react'
import { LinkButton } from '@/components/link-button'
import { newRequestRoute } from '@/lib/routes'
import type { FormRow } from '../schema'

export function FormCard({ form }: { form: FormRow }) {
  return (
    <Card padding="lg" component="article">
      <Stack gap="xs" h="100%" justify="space-between">
        <Stack gap={4}>
          <Text fw={600}>{form.name}</Text>
          <Text size="sm" c="dimmed" lineClamp={3}>
            {form.description || `${form.fields.length} questions.`}
          </Text>
        </Stack>
        <Group>
          <LinkButton
            href={newRequestRoute(form.id)}
            size="sm"
            leftSection={<IconFilePlus size={16} aria-hidden />}
          >
            Start
          </LinkButton>
        </Group>
      </Stack>
    </Card>
  )
}
