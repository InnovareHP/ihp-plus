import { QueryClient, isServer } from '@tanstack/react-query'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  })
}

let browserQueryClient: QueryClient | undefined

// A server render must never share a cache across requests; the browser must never lose one.
export function getQueryClient() {
  if (isServer) return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}
