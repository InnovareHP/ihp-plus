import { db } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { invitationTemplate, portalUrl, sendEmail } from '@/lib/email'
import { invitationRoute } from '@/lib/routes'
import { requireHiringCaller } from './access'
import { loadApplication } from './pipeline-service'
import type { ApplicationDetail } from './schema'

// Better Auth's own default for invitationExpiresIn, so a hire's invitation lasts like any other.
const INVITATION_TTL_MS = 48 * 60 * 60 * 1000

/**
 * The invitation row is written here rather than through Better Auth's createInvitation, which
 * only lets owners and admins invite; HR hires as ordinary members. Accepting it is still Better
 * Auth's own flow, which reads this same row.
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

  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS)
  const pending = await db.invitation.findFirst({
    where: { organizationId: caller.organizationId, email: row.email, status: 'pending' },
    select: { id: true },
  })
  const invitation = pending
    ? await db.invitation.update({
        where: { id: pending.id },
        data: { expiresAt, teamId, inviterId: caller.userId },
      })
    : await db.invitation.create({
        data: {
          id: crypto.randomUUID(),
          organizationId: caller.organizationId,
          email: row.email,
          role: 'member',
          teamId,
          status: 'pending',
          expiresAt,
          inviterId: caller.userId,
        },
      })

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
        detail: { invited: true, resent: row.status === 'hired' },
      },
    }),
  ])

  const organization = await db.organization.findUnique({
    where: { id: caller.organizationId },
    select: { name: true },
  })
  void sendEmail({
    to: row.email,
    ...invitationTemplate({
      organizationName: organization?.name ?? 'IHP+',
      inviterName: caller.name,
      url: portalUrl(invitationRoute(invitation.id)),
    }),
  })

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
