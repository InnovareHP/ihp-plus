'use client'

import { Button, Group, Stack } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { FormError } from '@/components/form-error'
import { track } from '@/lib/analytics'
import { routes } from '@/lib/routes'
import { acceptInvitation, rejectInvitation } from '../accept-actions'
import { organizationEvents } from '../events'

export interface AcceptInvitationFormProps {
  invitationId: string
  organizationName: string
}

export function AcceptInvitationForm({
  invitationId,
  organizationName,
}: AcceptInvitationFormProps) {
  const router = useRouter()

  const accept = useMutation({
    mutationFn: async () => {
      const result = await acceptInvitation({ invitationId })
      if (!result.ok) throw new Error(result.message)
    },
    onSuccess: () => {
      track(organizationEvents.invitationAccepted)
      router.replace(routes.dashboard)
      router.refresh()
    },
    onError: (error: Error) => {
      track(organizationEvents.invitationAcceptFailed, { reason: error.message })
    },
  })

  const decline = useMutation({
    mutationFn: async () => {
      const result = await rejectInvitation({ invitationId })
      if (!result.ok) throw new Error(result.message)
    },
    onSuccess: () => {
      router.replace(routes.login)
      router.refresh()
    },
  })

  const busy = accept.isPending || decline.isPending

  return (
    <Stack gap="md">
      <FormError
        message={accept.error?.message ?? decline.error?.message}
        title="Could not update this invitation"
      />
      <Group>
        <Button loading={accept.isPending} disabled={busy} onClick={() => accept.mutate()}>
          {accept.isPending ? 'Joining…' : `Join ${organizationName}`}
        </Button>
        <Button
          variant="subtle"
          color="gray"
          loading={decline.isPending}
          disabled={busy}
          onClick={() => decline.mutate()}
        >
          Decline
        </Button>
      </Group>
    </Stack>
  )
}
