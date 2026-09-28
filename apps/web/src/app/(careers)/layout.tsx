import { Anchor, Box, Container, Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { AppLogo } from '@/components/app-logo'
import { ColorSchemeToggle } from '@/components/color-scheme-toggle'
import { PAGE_WIDTH } from '@/components/page-shell'
import { SkipLink } from '@/components/skip-link'

// Route group: the public careers site, readable with or without a session.
export default function CareersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <Container size={PAGE_WIDTH} py={{ base: 'md', sm: 'xl' }}>
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <AppLogo />
            <ColorSchemeToggle />
          </Group>
          <Box component="main" id="main">
            {children}
          </Box>
          <Text size="xs" c="dimmed" ta="center">
            Questions about a role? Write to us from the{' '}
            <Anchor href="/" size="xs">
              main site
            </Anchor>
            .
          </Text>
        </Stack>
      </Container>
    </>
  )
}
