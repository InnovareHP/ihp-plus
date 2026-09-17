'use client'

import { Alert, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'

export default function OnboardingError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Paper withBorder radius="md" p="xl">
      <Stack gap="md">
        <Title order={1} size="h3">
          Setup could not load
        </Title>
        <Alert role="alert" color="red" title="Request failed" variant="light">
          <Text size="sm">
            Nothing you entered was lost on the server — your profile is still unfinished. Retrying
            usually fixes this.
          </Text>
        </Alert>
        <Group>
          <Button onClick={reset}>Try again</Button>
        </Group>
      </Stack>
    </Paper>
  )
}
