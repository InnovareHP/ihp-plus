'use client'

import { Alert, Button, Container, Group, Stack, Text, Title } from '@mantine/core'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container size="sm" py="xl">
      <main id="main">
        <Stack gap="md">
          <Title order={1}>Something went wrong</Title>
          <Alert role="alert" color="red" title="The page could not be loaded">
            <Text size="sm">
              The portal hit an unexpected error. Nothing you typed was sent. Try again, and if it
              keeps happening tell support what you were doing.
            </Text>
          </Alert>
          <Group>
            <Button onClick={reset}>Try again</Button>
          </Group>
        </Stack>
      </main>
    </Container>
  )
}
