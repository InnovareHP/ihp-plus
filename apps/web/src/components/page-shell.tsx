import { Container, Stack } from '@mantine/core'
import type { ReactNode } from 'react'

// Every page's padding and vertical rhythm is owned here, so AppShell.Main carries none.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <Container size="xl" px={{ base: 'md', sm: 'lg' }} py={{ base: 'lg', sm: 'xl' }}>
      <Stack gap="xl">{children}</Stack>
    </Container>
  )
}
