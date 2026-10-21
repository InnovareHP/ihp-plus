'use client'

import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { clearRecentSearches } from '@/features/search/utils/recent-searches'
import { routes } from '@/lib/routes'
import { authErrorMessage } from '../messages'

// Not optimistic: the server clears the cookie and the redirect to sign-in is the feedback.
export function useSignOut() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut()
      if (error) throw new Error(authErrorMessage(error))
    },
    onSuccess: () => {
      clearRecentSearches()
      // Every cached query answered for this person; the next one on this tab must not see it.
      queryClient.clear()
      router.replace(routes.login)
      router.refresh()
    },
    onError: (error: Error) => {
      notifications.show({ color: 'red', autoClose: false, message: error.message })
    },
  })
}
