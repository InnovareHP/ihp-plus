import { Box, Center, Paper, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { SkipLink } from '@/components/skip-link'

// Route group: everything here is reachable without a session and renders on one centred card.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <Center mih="100dvh" p="md">
        <Box component="main" id="main" w="100%" maw={420}>
          <Stack gap="lg">
            <Text fw={700} size="xl" ta="center">
              IHP Plus
            </Text>
            <Paper withBorder radius="md" p="xl">
              {children}
            </Paper>
          </Stack>
        </Box>
      </Center>
    </>
  )
}
