import { Container, Stack } from '@mantine/core'
import type { ReactNode } from 'react'

// Mantine's own sizes stop short of the app-shell width every page here is built to.
export const PAGE_WIDTH = '140rem'

// Every page's padding and vertical rhythm is owned here, so AppShell.Main carries none.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <Container size={PAGE_WIDTH} px={{ base: 'md', sm: 'lg' }} py={{ base: 'lg', sm: 'xl' }}>
      <Stack gap="xl">{children}</Stack>
    </Container>
  )
}
