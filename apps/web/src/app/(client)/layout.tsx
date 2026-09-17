import { Box, Container, Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { AppLogo } from '@/components/app-logo'
import { ColorSchemeToggle } from '@/components/color-scheme-toggle'
import { SkipLink } from '@/components/skip-link'

// Route group: pages a client opens from a link, readable with or without a session.
export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <Container size="md" py={{ base: 'md', sm: 'xl' }}>
        <Stack gap="lg">
          <Group justify="space-between" align="center" data-print-hidden>
            <AppLogo />
            <ColorSchemeToggle />
          </Group>
          <Box component="main" id="main">
            {children}
          </Box>
          <Text size="xs" c="dimmed" ta="center" data-print-hidden>
            Sent through IHP Plus · Innovare Health Partners
          </Text>
        </Stack>
      </Container>
    </>
  )
}
