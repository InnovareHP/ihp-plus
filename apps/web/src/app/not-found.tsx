'use client'

import { Anchor, Button, Container, Stack, Text, Title } from '@mantine/core'
import Link from 'next/link'
import { routes } from '@/lib/routes'

export default function NotFound() {
  return (
    <Container size="sm" py="xl">
      <main id="main">
        <Stack gap="md">
          <Title order={1}>Page not found</Title>
          <Text c="dimmed">
            That URL does not match anything in the portal. It may have moved, or the link may be
            stale.
          </Text>
          <Button component={Link} href={routes.dashboard} w="fit-content">
            Back to dashboard
          </Button>
          <Text size="sm">
            Still stuck? <Anchor href="mailto:support@innovarehp.com">Email support</Anchor>.
          </Text>
        </Stack>
      </main>
    </Container>
  )
}
