'use client'

import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { routes } from '@/lib/routes'
import { authErrorMessage } from '../messages'

// Not optimistic: the server clears the cookie and the redirect to sign-in is the feedback.
export function useSignOut() {
  const router = useRouter()

  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut()
      if (error) throw new Error(authErrorMessage(error))
    },
    onSuccess: () => {
      router.replace(routes.login)
      router.refresh()
    },
    onError: (error: Error) => {
      notifications.show({ color: 'red', autoClose: false, message: error.message })
    },
  })
}
