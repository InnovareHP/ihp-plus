import { Anchor, Box, Center, Group, Paper, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { AppLogo } from '@/components/app-logo'
import { ColorSchemeToggle } from '@/components/color-scheme-toggle'
import { SkipLink } from '@/components/skip-link'

// Route group: everything here is reachable without a session and renders on one centred card.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <Center mih="100dvh" p="md">
        <Box component="main" id="main" w="100%" maw={440}>
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <AppLogo />
              <ColorSchemeToggle />
            </Group>

            <Paper withBorder radius="md" p={{ base: 'lg', sm: 'xl' }} shadow="sm">
              {children}
            </Paper>

            <Text size="xs" c="dimmed" ta="center">
              Trouble signing in?{' '}
              <Anchor href="mailto:support@innovarehp.com" size="xs">
                Email support
              </Anchor>
            </Text>
          </Stack>
        </Box>
      </Center>
    </>
  )
}
