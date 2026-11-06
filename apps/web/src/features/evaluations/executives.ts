import { db } from '@ihp/db'

// Departments are named by people, so either spelling of the leadership team counts.
const EXECUTIVE_DEPARTMENTS = ['Executive', 'Executives'] as const

/** Everyone in the organization's Executive department, who receive and may read evaluations. */
export async function executiveUserIds(organizationId: string): Promise<string[]> {
  const members = await db.teamMember.findMany({
    where: {
      team: {
        organizationId,
        OR: EXECUTIVE_DEPARTMENTS.map((name) => ({
          name: { equals: name, mode: 'insensitive' as const },
        })),
      },
    },
    select: { userId: true },
  })
  return [...new Set(members.map((member) => member.userId))]
}
