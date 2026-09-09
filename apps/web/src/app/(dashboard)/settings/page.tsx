import { Card, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const { user } = await requireSession()

  return (
    <Stack gap="lg">
      <Title order={1} size="h2">
        Settings
      </Title>
      <Card withBorder radius="md" padding="lg">
        <Stack gap="xs">
          <Title order={2} size="h5">
            Account
          </Title>
          <Text size="sm" c="dimmed">
            Name: {user.name}
          </Text>
          <Text size="sm" c="dimmed">
            Email: {user.email}
          </Text>
        </Stack>
      </Card>
    </Stack>
  )
}
