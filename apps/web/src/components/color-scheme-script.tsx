'use client'

import { ColorSchemeScript as MantineColorSchemeScript } from '@mantine/core'

// React warns on a client-rendered <script>, so the browser copy is inert text/plain (Next 16's own guidance).
export function ColorSchemeScript() {
  return (
    <MantineColorSchemeScript
      defaultColorScheme="auto"
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
    />
  )
}
