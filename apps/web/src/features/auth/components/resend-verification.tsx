'use client'

import { Button, Stack, Text } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { FormError } from '@/components/form-error'
import { authClient } from '@/lib/auth-client'
import { withBasePath } from '@/lib/routes'
import { authErrorMessage } from '../messages'

export interface ResendVerificationProps {
  email: string
  /** Where confirming the address lands, once it has signed them in. */
  next: string
}

export function ResendVerification({ email, next }: ResendVerificationProps) {
  const resend = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: withBasePath(next),
      })
      if (error) throw new Error(authErrorMessage(error))
    },
  })

  return (
    <Stack gap="xs" align="flex-start">
      <FormError message={resend.error?.message} title="Could not send another link" />

      <Button variant="default" loading={resend.isPending} onClick={() => resend.mutate()}>
        {resend.isPending ? 'Sending…' : 'Send the link again'}
      </Button>

      {/* The result is the whole feedback, and it is off-screen for a screen reader otherwise. */}
      <Text size="sm" c="dimmed" role="status" aria-live="polite">
        {resend.isSuccess ? `Sent again to ${email}. It can take a minute to arrive.` : ''}
      </Text>
    </Stack>
  )
}
