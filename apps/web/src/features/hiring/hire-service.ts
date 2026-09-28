import { db } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { requireHiringCaller } from './access'
import { loadApplication } from './pipeline-service'
import type { ApplicationDetail } from './schema'

/**
 * The invitation goes through Better Auth as the HR person themselves, so it is created, resent,
 * emailed and accepted exactly like one an admin sends; lib/invitation-policy decides who may.
 */
export async function hireApplication(input: {
  applicationId: string
  teamId: string
}): Promise<ApplicationDetail> {
  const caller = await requireHiringCaller()
  const row = await db.jobApplication.findFirst({
    where: { id: input.applicationId, organizationId: caller.organizationId },
    include: { posting: { select: { teamId: true } } },
  })
  if (!row) throw new ConnectError('That application no longer exists.', Code.NotFound)
  if (row.status !== 'active' && row.status !== 'hired') {
    throw new ConnectError(
      'This application was closed, so reopen it before hiring them.',
      Code.FailedPrecondition,
    )
  }
  if (row.hiredUserId) {
    throw new ConnectError('They have already joined.', Code.FailedPrecondition)
  }

  const teamId = input.teamId || row.posting.teamId || null
  if (teamId) {
    const team = await db.team.findFirst({
      where: { id: teamId, organizationId: caller.organizationId },
      select: { id: true },
    })
    if (!team) throw new ConnectError('That department no longer exists.', Code.NotFound)
  }

  const now = new Date()
  const decision = { status: 'hired', decidedById: caller.userId, decidedAt: now }

  // Someone already in the organization — an internal move — needs no invitation to join it.
  const member = await db.member.findFirst({
    where: { organizationId: caller.organizationId, user: { email: row.email } },
    select: { userId: true },
  })
  if (member) {
    await db.$transaction([
      db.jobApplication.update({
        where: { id: row.id },
        data: { ...decision, hiredUserId: member.userId },
      }),
      db.applicationEvent.create({
        data: {
          applicationId: row.id,
          actorId: caller.userId,
          kind: 'hired',
          detail: { existingMember: true },
        },
      }),
    ])
    return loadApplication(row.id)
  }

  const pending = await db.invitation.findFirst({
    where: { organizationId: caller.organizationId, email: row.email, status: 'pending' },
    select: { id: true },
  })

  let invitation: { id: string }
  try {
    // resend: a second hire of the same person refreshes the one invitation instead of refusing.
    invitation = await auth.api.createInvitation({
      body: {
        email: row.email,
        role: 'member',
        organizationId: caller.organizationId,
        resend: true,
        ...(teamId ? { teamId } : {}),
      },
      headers: await headers(),
    })
  } catch (error) {
    throw new ConnectError(
      error instanceof Error && error.message
        ? error.message
        : 'Could not send the invitation — try again.',
      Code.FailedPrecondition,
    )
  }

  await db.$transaction([
    db.jobApplication.update({
      where: { id: row.id },
      data: { ...decision, invitationId: invitation.id },
    }),
    db.applicationEvent.create({
      data: {
        applicationId: row.id,
        actorId: caller.userId,
        kind: 'hired',
        detail: { invited: true, resent: Boolean(pending) },
      },
    }),
  ])

  return loadApplication(row.id)
}

/** Ties the account an invitation became back to the application that led to it. */
export async function linkHiredApplicant(invitationId: string, userId: string) {
  const application = await db.jobApplication.findFirst({
    where: { invitationId, status: 'hired', hiredUserId: null },
    select: { id: true },
  })
  if (!application) return

  await db.$transaction([
    db.jobApplication.update({ where: { id: application.id }, data: { hiredUserId: userId } }),
    db.applicationEvent.create({
      data: { applicationId: application.id, actorId: userId, kind: 'joined', detail: {} },
    }),
  ])
}
