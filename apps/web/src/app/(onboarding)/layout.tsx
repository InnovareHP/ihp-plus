import { Box, Center, Group, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { AppLogo } from '@/components/app-logo'
import { ColorSchemeToggle } from '@/components/color-scheme-toggle'
import { SkipLink } from '@/components/skip-link'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { requireOnboarding } from '@/lib/auth-guard'

// Route group: a session is required, but the dashboard chrome is not — this is the gate to it.
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await requireOnboarding()

  return (
    <>
      <SkipLink />
      <Center mih="100dvh" p={{ base: 'md', sm: 'xl' }}>
        <Box component="main" id="main" w="100%" maw={720}>
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <AppLogo />
              <Group gap="xs">
                <ColorSchemeToggle />
                <SignOutButton />
              </Group>
            </Group>
            {children}
          </Stack>
        </Box>
      </Center>
    </>
  )
}
