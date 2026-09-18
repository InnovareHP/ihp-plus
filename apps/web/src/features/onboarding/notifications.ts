import { db } from '@ihp/db'
import { memberJoinedTemplate, portalUrl, sendEmail } from '@/lib/email'
import { organizationTab } from '@/lib/routes'

// The organization roles that manage members, mirroring canManageOrganization.
const ADMIN_ROLES = ['owner', 'admin']

export interface JoinedMember {
  organizationId: string
  userId: string
  memberName: string
  teamName: string
  jobTitle: string
}

/**
 * Tells the organization's admins that somebody finished onboarding: until they do, a new hire
 * is an invitation nobody knows was accepted. Never throws — the profile is already saved.
 */
export async function notifyAdminsOfNewMember(member: JoinedMember) {
  try {
    const admins = await db.member.findMany({
      where: { organizationId: member.organizationId, role: { in: ADMIN_ROLES } },
      select: { userId: true },
    })

    // Nobody is told about their own onboarding, which the seeded owner would otherwise get.
    const adminIds = [...new Set(admins.map((row) => row.userId))].filter(
      (userId) => userId !== member.userId,
    )
    if (adminIds.length === 0) return

    const recipients = await db.user.findMany({
      where: { id: { in: adminIds } },
      select: { email: true },
    })

    const message = memberJoinedTemplate({
      memberName: member.memberName,
      teamName: member.teamName,
      jobTitle: member.jobTitle,
      url: portalUrl(organizationTab('members')),
    })

    // One message per admin, so nobody's address is shown to the others.
    for (const recipient of recipients) {
      void sendEmail({ to: recipient.email, ...message })
    }
  } catch (error) {
    console.error(`[onboarding] could not announce ${member.userId}`, error)
  }
}
