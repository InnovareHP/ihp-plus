import { db } from '@ihp/db'
import {
  applicationReceivedTemplate,
  applicationRejectedTemplate,
  applicationStageTemplate,
  newApplicantTemplate,
  portalUrl,
  sendEmail,
} from '@/lib/email'
import { applicationRoute } from '@/lib/routes'

export function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

/** The HR department when one is set, otherwise the admins: whoever can act on the applicant. */
async function hiringTeamEmails(organizationId: string) {
  const settings = await db.hiringSettings.findUnique({
    where: { organizationId },
    select: { hrTeamId: true },
  })

  if (settings?.hrTeamId) {
    const members = await db.teamMember.findMany({
      where: { teamId: settings.hrTeamId },
      select: { user: { select: { email: true, banned: true } } },
    })
    const emails = members.filter((row) => !row.user.banned).map((row) => row.user.email)
    if (emails.length > 0) return emails
  }

  const admins = await db.member.findMany({
    where: { organizationId, role: { in: ['owner', 'admin'] } },
    select: { user: { select: { email: true, banned: true } } },
  })
  return admins.filter((row) => !row.user.banned).map((row) => row.user.email)
}

export interface ReceivedApplication {
  applicationId: string
  organizationId: string
  organizationName: string
  fullName: string
  email: string
  postingTitle: string
  statusUrl: string
}

/** Never throws: the application is already saved, and a mail outage must not undo that. */
export async function notifyApplicationReceived(application: ReceivedApplication) {
  try {
    void sendEmail({
      to: application.email,
      ...applicationReceivedTemplate({
        organizationName: application.organizationName,
        firstName: firstNameOf(application.fullName),
        postingTitle: application.postingTitle,
        url: application.statusUrl,
      }),
    })

    const team = await hiringTeamEmails(application.organizationId)
    const email = newApplicantTemplate({
      applicantName: application.fullName,
      postingTitle: application.postingTitle,
      url: portalUrl(applicationRoute(application.applicationId)),
    })
    for (const to of team) void sendEmail({ to, ...email })
  } catch (error) {
    console.error(`[hiring] could not notify about ${application.applicationId}`, error)
  }
}

export interface ApplicantMessage {
  applicationId: string
  organizationName: string
  fullName: string
  email: string
  postingTitle: string
  message: string
}

/** A stage's message, carrying the status link so the applicant can see where they stand. */
export function notifyStageMessage(application: ApplicantMessage & { statusUrl: string }) {
  try {
    void sendEmail({
      to: application.email,
      ...applicationStageTemplate({
        organizationName: application.organizationName,
        firstName: firstNameOf(application.fullName),
        postingTitle: application.postingTitle,
        message: application.message,
        url: application.statusUrl,
      }),
    })
  } catch (error) {
    console.error(`[hiring] could not email ${application.applicationId}`, error)
  }
}

export function notifyRejected(application: ApplicantMessage) {
  try {
    void sendEmail({
      to: application.email,
      ...applicationRejectedTemplate({
        organizationName: application.organizationName,
        firstName: firstNameOf(application.fullName),
        postingTitle: application.postingTitle,
        message: application.message,
      }),
    })
  } catch (error) {
    console.error(`[hiring] could not email ${application.applicationId}`, error)
  }
}
