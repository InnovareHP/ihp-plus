'use client'

import { Alert, Button, Group, Text } from '@mantine/core'
import { PageHeader, PageShell } from '@/components/page-shell'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageShell>
      <PageHeader title="This page could not load" />
      <Alert role="alert" color="red" title="Request failed" variant="light">
        <Text size="sm">
          The portal could not reach the server. Your session is still valid — retrying usually
          fixes it.
        </Text>
      </Alert>
      <Group>
        <Button onClick={reset}>Try again</Button>
      </Group>
    </PageShell>
  )
}
