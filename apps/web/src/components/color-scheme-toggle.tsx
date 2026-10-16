'use client'

import { ActionIcon, Box, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { useMounted } from '@mantine/hooks'

export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light')
  // A saved scheme lives in localStorage, which the server never sees, so the label waits for mount.
  const mounted = useMounted()
  const next = computed === 'dark' ? 'light' : 'dark'

  return (
    <ActionIcon
      variant="default"
      size="lg"
      aria-label={mounted ? `Switch to ${next} theme` : 'Switch color theme'}
      onClick={() => setColorScheme(next)}
    >
      {/* CSS picks the glyph, so the icon is right before hydration too. */}
      <Box component="span" aria-hidden="true" darkHidden>
        ☾
      </Box>
      <Box component="span" aria-hidden="true" lightHidden>
        ☀
      </Box>
    </ActionIcon>
  )
}
