'use client'

import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Stack gap="md">
      <Title order={1} size="h2">
        This page could not load
      </Title>
      <Alert role="alert" color="red" title="Request failed" variant="light">
        <Text size="sm">
          The portal could not reach the server. Your session is still valid — retrying usually
          fixes it.
        </Text>
      </Alert>
      <Group>
        <Button onClick={reset}>Try again</Button>
      </Group>
    </Stack>
  )
}
