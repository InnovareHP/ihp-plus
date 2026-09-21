import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { theme } from '@/theme'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

// env="test" drops Mantine's transitions and portals so queries see the real DOM.
export function render(ui: ReactElement) {
  const queryClient = makeQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider theme={theme} env="test">
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MantineProvider>
    )
  }

  return rtlRender(ui, { wrapper: Wrapper })
}

export { act, screen, waitFor, within } from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
