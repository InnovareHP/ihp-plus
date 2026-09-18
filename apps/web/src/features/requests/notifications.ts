import { db } from '@ihp/db'
import {
  portalUrl,
  requestDecidedTemplate,
  requestReceivedTemplate,
  requestSubmittedTemplate,
  requestWithdrawnTemplate,
  sendEmail,
} from '@/lib/email'
import { requestRoute } from '@/lib/routes'
import type { Decision } from './schema'

// The organization roles that may decide a request from any department.
const ADMIN_ROLES = ['owner', 'admin']

export interface SubmittedRequest {
  submissionId: string
  organizationId: string
  teamId: string
  teamName: string
  formName: string
  requesterId: string
  requesterName: string
}

export interface DecidedRequest {
  submissionId: string
  requesterId: string
  formName: string
  decision: Decision
  deciderName: string
  note: string | undefined
}

/** Emails whoever can decide a new request. Never throws: the request is already saved. */
export async function notifyApprovers(request: SubmittedRequest) {
  try {
    const queue = await approverQueue(request)
    if (queue.emails.length === 0) return

    const message = requestSubmittedTemplate({
      requesterName: request.requesterName,
      formName: request.formName,
      teamName: request.teamName,
      asAdmin: queue.asAdmin,
      url: portalUrl(requestRoute(request.submissionId)),
    })

    // One message per person, so approvers never see each other's addresses.
    for (const email of queue.emails) {
      void sendEmail({ to: email, ...message })
    }
  } catch (error) {
    console.error(`[requests] could not notify approvers of ${request.submissionId}`, error)
  }
}

/**
 * Emails the requester that it landed and who has it. A receipt rather than a courtesy: without
 * it the only way to know a request was filed is to open the portal and look.
 */
export async function notifyRequesterReceived(request: SubmittedRequest) {
  try {
    const [requester, queue] = await Promise.all([
      db.user.findUnique({ where: { id: request.requesterId }, select: { email: true } }),
      approverQueue(request),
    ])
    if (!requester) return

    void sendEmail({
      to: requester.email,
      ...requestReceivedTemplate({
        formName: request.formName,
        teamName: request.teamName,
        approverCount: queue.emails.length,
        asAdmin: queue.asAdmin,
        url: portalUrl(requestRoute(request.submissionId)),
      }),
    })
  } catch (error) {
    console.error(`[requests] could not confirm ${request.submissionId} to its requester`, error)
  }
}

/** Tells the queue a pending request left it, so nobody opens it looking for a decision. */
export async function notifyApproversWithdrawn(request: SubmittedRequest) {
  try {
    const queue = await approverQueue(request)
    if (queue.emails.length === 0) return

    const message = requestWithdrawnTemplate({
      requesterName: request.requesterName,
      formName: request.formName,
      teamName: request.teamName,
      url: portalUrl(requestRoute(request.submissionId)),
    })

    for (const email of queue.emails) {
      void sendEmail({ to: email, ...message })
    }
  } catch (error) {
    console.error(`[requests] could not notify approvers of ${request.submissionId}`, error)
  }
}

/** Emails the requester the decision and its note. Never throws: the decision is already saved. */
export async function notifyRequester(request: DecidedRequest) {
  try {
    const requester = await db.user.findUnique({
      where: { id: request.requesterId },
      select: { email: true },
    })
    if (!requester) return

    void sendEmail({
      to: requester.email,
      ...requestDecidedTemplate({
        formName: request.formName,
        decision: request.decision,
        deciderName: request.deciderName,
        note: request.note,
        url: portalUrl(requestRoute(request.submissionId)),
      }),
    })
  } catch (error) {
    console.error(`[requests] could not notify the requester of ${request.submissionId}`, error)
  }
}

/** Who a request sits with: the department's approvers, or the admins when it has none. */
async function approverQueue(request: SubmittedRequest) {
  const approvers = await db.requestApprover.findMany({
    where: { organizationId: request.organizationId, teamId: request.teamId },
    select: { userId: true },
  })

  // A department with no appointed approver falls to the admins, who can decide any request.
  const asAdmin = approvers.length === 0
  const candidateIds = asAdmin
    ? await adminIds(request.organizationId)
    : approvers.map((row) => row.userId)

  // Nobody is asked to approve their own request.
  const recipientIds = [...new Set(candidateIds)].filter((userId) => userId !== request.requesterId)
  if (recipientIds.length === 0) return { asAdmin, emails: [] as string[] }

  const recipients = await db.user.findMany({
    where: { id: { in: recipientIds } },
    select: { email: true },
  })
  return { asAdmin, emails: recipients.map((recipient) => recipient.email) }
}

// Mirrors canManageOrganization: organization owners and admins, plus portal admins.
async function adminIds(organizationId: string) {
  const [members, portalAdmins] = await Promise.all([
    db.member.findMany({
      where: { organizationId, role: { in: ADMIN_ROLES } },
      select: { userId: true },
    }),
    db.user.findMany({ where: { role: 'admin' }, select: { id: true } }),
  ])
  return [...members.map((row) => row.userId), ...portalAdmins.map((row) => row.id)]
}
