'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure, announceSuccess } from '@/lib/announce'
import { cancelInvitation, inviteMember, listInvitations, resendInvitation } from './actions'
import { organizationEvents } from './events'
import { organizationKeys } from './query-keys'
import { useOptimisticListMutation } from '@/lib/optimistic'
import type { InvitationRow, InviteMemberValues } from './schema'

export function useInvitations() {
  return useQuery({
    queryKey: organizationKeys.invitations(),
    queryFn: async () => {
      const result = await listInvitations()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
  })
}

export function useInviteMember() {
  return useOptimisticListMutation<
    InvitationRow,
    InviteMemberValues & { teamName: string; invitedBy: string }
  >({
    queryKey: organizationKeys.invitations(),
    mutationFn: async ({ email, role, teamId }) => {
      const result = await inviteMember({ email, role, teamId })
      if (!result.ok) throw new Error(result.message)
    },
    // The real id and expiry arrive with the refetch, so the pending row carries placeholders.
    apply: (rows, values) => [
      {
        id: `pending-${values.email}`,
        email: values.email.toLowerCase(),
        role: values.role,
        teamName: values.teamName,
        status: 'pending',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        expired: false,
        invitedBy: values.invitedBy,
      },
      ...rows.filter((row) => row.email !== values.email.toLowerCase()),
    ],
    successEvent: organizationEvents.invitationSent,
    failureEvent: organizationEvents.invitationSendFailed,
    alsoInvalidate: [organizationKeys.summary()],
  })
}

export function useCancelInvitation() {
  return useOptimisticListMutation<InvitationRow, { invitationId: string }>({
    queryKey: organizationKeys.invitations(),
    mutationFn: async (values) => {
      const result = await cancelInvitation(values)
      if (!result.ok) throw new Error(result.message)
    },
    apply: (rows, values) => rows.filter((row) => row.id !== values.invitationId),
    successEvent: organizationEvents.invitationCanceled,
    failureEvent: organizationEvents.invitationCancelFailed,
    alsoInvalidate: [organizationKeys.summary()],
  })
}

// Not optimistic: the server sets the new expiry, which is the only thing a resend changes.
export function useResendInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: { invitationId: string; email: string }) => {
      const result = await resendInvitation({ invitationId: values.invitationId })
      if (!result.ok) throw new Error(result.message)
    },
    onSuccess: (_data, values) => {
      track(organizationEvents.invitationResent)
      announceSuccess(`Invitation resent to ${values.email}.`)
    },
    onError: (error: Error) => {
      track(organizationEvents.invitationResendFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.invitations() })
    },
  })
}
