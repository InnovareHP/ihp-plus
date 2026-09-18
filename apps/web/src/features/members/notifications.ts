import { db } from '@ihp/db'
import {
  memberAccessChangedTemplate,
  memberRoleChangedTemplate,
  portalUrl,
  sendEmail,
} from '@/lib/email'
import { routes } from '@/lib/routes'

export interface RoleChange {
  organizationId: string
  userId: string
  scope: 'organization' | 'portal'
  roleLabel: string
  changedByName: string
}

export interface AccessChange {
  organizationId: string
  userId: string
  suspended: boolean
  changedByName: string
}

/**
 * Tells someone their own role moved. What the portal offers them changes without warning
 * otherwise, and the person who changed it is not always the one they would ask.
 * Never throws: the role is already changed.
 */
export async function notifyRoleChanged(change: RoleChange) {
  try {
    const recipient = await recipientOf(change.organizationId, change.userId)
    if (!recipient) return

    void sendEmail({
      to: recipient.email,
      ...memberRoleChangedTemplate({
        organizationName: recipient.organizationName,
        scope: change.scope,
        roleLabel: change.roleLabel,
        changedByName: change.changedByName,
        url: portalUrl(routes.dashboard),
      }),
    })
  } catch (error) {
    console.error(`[members] could not tell ${change.userId} their role changed`, error)
  }
}

/** Tells someone they were suspended or let back in, since sign-in stops explaining itself. */
export async function notifyAccessChanged(change: AccessChange) {
  try {
    const recipient = await recipientOf(change.organizationId, change.userId)
    if (!recipient) return

    void sendEmail({
      to: recipient.email,
      ...memberAccessChangedTemplate({
        organizationName: recipient.organizationName,
        suspended: change.suspended,
        changedByName: change.changedByName,
        url: portalUrl(routes.login),
      }),
    })
  } catch (error) {
    console.error(`[members] could not tell ${change.userId} their access changed`, error)
  }
}

async function recipientOf(organizationId: string, userId: string) {
  const [user, organization] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { email: true } }),
    db.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
  ])
  if (!user) return null

  return { email: user.email, organizationName: organization?.name ?? 'your organization' }
}
