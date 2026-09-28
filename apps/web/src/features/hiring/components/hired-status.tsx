'use client'

import { Alert, Button, Stack, Text } from '@mantine/core'
import { describeMoment } from '@/lib/relative-time'

export interface HiredStatusProps {
  email: string
  joined: boolean
  invitationExpiresAt: string | undefined
  isResending: boolean
  onResend: () => void
}

/** Where a hire stands between the offer and their first day in the portal. */
export function HiredStatus({
  email,
  joined,
  invitationExpiresAt,
  isResending,
  onResend,
}: HiredStatusProps) {
  if (joined) {
    return (
      <Alert color="green" variant="light" title="Joined">
        <Text size="sm">
          They have an account now. Their new-hire checklist starts once they finish onboarding.
        </Text>
      </Alert>
    )
  }

  // The server only reports an expiry while the link still works.
  const expired = !invitationExpiresAt

  return (
    <Alert color={expired ? 'yellow' : 'blue'} variant="light" title="Invitation sent">
      <Stack gap="xs">
        <Text size="sm">
          {expired
            ? `The invitation to ${email} has expired without being accepted.`
            : `Waiting for ${email} to accept. The link works until ${describeMoment(invitationExpiresAt)}.`}
        </Text>
        <Button
          variant="default"
          size="compact-sm"
          w="fit-content"
          loading={isResending}
          onClick={onResend}
        >
          {isResending ? 'Sending…' : 'Send the invitation again'}
        </Button>
      </Stack>
    </Alert>
  )
}
