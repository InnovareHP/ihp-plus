import { db } from '@ihp/db'
import { clientOwnerAssignedTemplate, portalUrl, sendEmail } from '@/lib/email'
import { routes } from '@/lib/routes'

export interface OwnerAssignment {
  clientName: string
  ownerId: string
  assignedById: string
  assignedByName: string
}

/**
 * Tells whoever now owns a client that it is theirs — an owner set by somebody else is
 * otherwise a silent handover. Never throws: the client is already saved.
 */
export async function notifyOwnerAssigned(assignment: OwnerAssignment) {
  try {
    // Somebody taking a client themselves does not need to be told they did.
    if (assignment.ownerId === assignment.assignedById) return

    const owner = await db.user.findUnique({
      where: { id: assignment.ownerId },
      select: { email: true },
    })
    if (!owner) return

    void sendEmail({
      to: owner.email,
      ...clientOwnerAssignedTemplate({
        clientName: assignment.clientName,
        assignedByName: assignment.assignedByName,
        url: portalUrl(routes.clients),
      }),
    })
  } catch (error) {
    console.error(`[clients] could not tell ${assignment.ownerId} they own a client`, error)
  }
}
