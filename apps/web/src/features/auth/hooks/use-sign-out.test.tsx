import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recentKey } from '@/features/search/utils/recent-searches'
import { useSignOut } from './use-sign-out'

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))
const auth = vi.hoisted(() => ({ authClient: { signOut: vi.fn() } }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/lib/auth-client', () => auth)

function renderSignOut() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, ...renderHook(() => useSignOut(), { wrapper }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  auth.authClient.signOut.mockResolvedValue({ error: null })
})

describe('useSignOut', () => {
  it('forgets everything cached for this person, so the next sign-in on the tab starts clean', async () => {
    const { queryClient, result } = renderSignOut()
    queryClient.setQueryData(['search', 'directory'], { people: [{ name: 'Grace' }], clients: [] })
    window.localStorage.setItem(recentKey('org-1', 'user-1'), '[]')

    act(() => result.current.mutate())

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(queryClient.getQueryData(['search', 'directory'])).toBeUndefined()
    expect(window.localStorage.getItem(recentKey('org-1', 'user-1'))).toBeNull()
  })

  it('keeps the cache when sign-out fails, since the same person is still signed in', async () => {
    auth.authClient.signOut.mockResolvedValue({ error: { message: 'Network down' } })
    const { queryClient, result } = renderSignOut()
    queryClient.setQueryData(['search', 'directory'], { people: [], clients: [] })

    act(() => result.current.mutate())

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData(['search', 'directory'])).toEqual({ people: [], clients: [] })
  })
})
