'use client'

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getQueryClient } from '@/lib/query-client'
import { cssVariablesResolver, theme } from '@/theme'

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="auto"
    >
      <QueryClientProvider client={queryClient}>
        {/* Mantine notifications render with role="alert", which is what announces a rollback. */}
        <Notifications position="top-right" autoClose={5000} limit={1} />
        {children}
      </QueryClientProvider>
    </MantineProvider>
  )
}
