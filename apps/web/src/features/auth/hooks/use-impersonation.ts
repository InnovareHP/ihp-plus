'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { authClient } from '@/lib/auth-client'
import { organizationTab, routes } from '@/lib/routes'
import { authEvents } from '../events'
import { authErrorMessage } from '../messages'

// Not optimistic: the session swap happens in a cookie, so the page cannot move before it lands.
function useSessionSwap(options: {
  swap: (userId: string | void) => Promise<{ error: { code?: string; message?: string } | null }>
  destination: string
  successEvent: (typeof authEvents)[keyof typeof authEvents]
  failureEvent: (typeof authEvents)[keyof typeof authEvents]
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string | void) => {
      const { error } = await options.swap(userId)
      if (error) throw new Error(authErrorMessage(error))
    },
    onSuccess: (_data, userId) => {
      track(options.successEvent, { userId: userId ?? null })
      // Every cached query answered for the previous person, so none of it may reach the next.
      queryClient.clear()
      router.replace(options.destination)
      router.refresh()
    },
    onError: (error: Error, userId) => {
      track(options.failureEvent, { userId: userId ?? null, reason: error.message })
      announceFailure(error.message)
    },
  })
}

export function useImpersonate() {
  return useSessionSwap({
    swap: (userId) => authClient.admin.impersonateUser({ userId: userId ?? '' }),
    destination: routes.dashboard,
    successEvent: authEvents.impersonationStarted,
    failureEvent: authEvents.impersonationFailed,
  })
}

export function useStopImpersonating() {
  return useSessionSwap({
    swap: () => authClient.admin.stopImpersonating(),
    destination: organizationTab('members'),
    successEvent: authEvents.impersonationStopped,
    failureEvent: authEvents.impersonationStopFailed,
  })
}
