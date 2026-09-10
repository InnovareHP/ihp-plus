import { db } from '@ihp/db'
import { Alert, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { LinkAnchor } from '@/components/link-anchor'
import { AcceptInvitationForm } from '@/features/organization/components/accept-invitation-form'
import { getSession } from '@/lib/auth-guard'
import { invitationRoute, routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Accept invitation' }

const expires = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

// The clock read lives outside the component: rendering has to stay pure.
async function readInvitation(id: string) {
  const invitation = await db.invitation.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      teamId: true,
      expiresAt: true,
      organization: { select: { name: true } },
      user: { select: { name: true } },
    },
  })
  if (!invitation) return null

  const team = invitation.teamId
    ? await db.team.findUnique({ where: { id: invitation.teamId }, select: { name: true } })
    : null

  return { ...invitation, team, expired: invitation.expiresAt.getTime() < Date.now() }
}

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const invitation = await readInvitation(id)

  if (!invitation) {
    return (
      <Outcome title="This invitation could not be found">
        The link may have been mistyped or the invitation was cancelled. Ask whoever invited you to
        send a new one.
      </Outcome>
    )
  }

  if (invitation.status !== 'pending') {
    return (
      <Outcome title="This invitation is no longer open">
        It has already been {invitation.status === 'accepted' ? 'accepted' : 'closed'}. Sign in, or
        ask for a fresh invitation.
      </Outcome>
    )
  }

  if (invitation.expired) {
    return (
      <Outcome title="This invitation has expired">
        It lapsed on {expires.format(invitation.expiresAt)}. Ask {invitation.user.name} to resend
        it.
      </Outcome>
    )
  }

  const session = await getSession()

  return (
    <Stack gap="md">
      <Title order={1} size="h3">
        Join {invitation.organization.name}
      </Title>
      <Text size="sm" c="dimmed">
        {invitation.user.name} invited <strong>{invitation.email}</strong> to join as a{' '}
        {invitation.role ?? 'member'}
        {invitation.team ? ` in ${invitation.team.name}` : ''}. The invitation is open until{' '}
        {expires.format(invitation.expiresAt)}.
      </Text>

      {!session ? (
        <Alert color="blue" variant="light" title="Sign in first">
          <Text size="sm">
            Sign in as {invitation.email} to accept, then you land back here.{' '}
            <LinkAnchor
              href={`${routes.login}?next=${encodeURIComponent(invitationRoute(invitation.id))}`}
              size="sm"
            >
              Sign in
            </LinkAnchor>{' '}
            or{' '}
            <LinkAnchor
              href={`${routes.signup}?next=${encodeURIComponent(invitationRoute(invitation.id))}`}
              size="sm"
            >
              create an account
            </LinkAnchor>
            .
          </Text>
        </Alert>
      ) : session.user.email.toLowerCase() !== invitation.email.toLowerCase() ? (
        <Alert role="alert" color="yellow" variant="light" title="Signed in as someone else">
          <Text size="sm">
            This invitation is for {invitation.email}, but you are signed in as {session.user.email}
            . Sign out and sign back in with the invited address.
          </Text>
        </Alert>
      ) : (
        <AcceptInvitationForm
          invitationId={invitation.id}
          organizationName={invitation.organization.name}
        />
      )}
    </Stack>
  )
}

function Outcome({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="md">
      <Title order={1} size="h3">
        {title}
      </Title>
      <Text size="sm" c="dimmed">
        {children}
      </Text>
      <LinkAnchor href={routes.login} size="sm">
        Go to sign in
      </LinkAnchor>
    </Stack>
  )
}
