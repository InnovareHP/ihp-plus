import { Card, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const { user, session } = await requireSession()

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h2">
          Welcome back, {user.name}
        </Title>
        <Text c="dimmed">Signed in as {user.email}</Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Card withBorder radius="md" padding="lg">
          <Title order={2} size="h5">
            Session
          </Title>
          <Text size="sm" c="dimmed" mt="xs">
            Expires {new Date(session.expiresAt).toLocaleString()}
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Title order={2} size="h5">
            Email verified
          </Title>
          <Text size="sm" c="dimmed" mt="xs">
            {user.emailVerified ? 'Yes' : 'Not yet — check your inbox'}
          </Text>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}
