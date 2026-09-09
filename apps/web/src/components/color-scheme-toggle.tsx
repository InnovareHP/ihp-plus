'use client'

import { ActionIcon, useMantineColorScheme } from '@mantine/core'

export function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const next = colorScheme === 'dark' ? 'light' : 'dark'

  return (
    <ActionIcon
      variant="default"
      size="lg"
      aria-label={`Switch to ${next} theme`}
      onClick={() => setColorScheme(next)}
    >
      <span aria-hidden="true">{colorScheme === 'dark' ? '☀' : '☾'}</span>
    </ActionIcon>
  )
}
