import { db } from '@ihp/db'

/**
 * Department leads, read and written in one place. The bluebook is the first consumer — a lead
 * curates their department's shelf — and anything later that needs "who runs this department"
 * reads the same rows.
 */
export async function listLeads(organizationId: string) {
  const leads = await db.teamLead.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, teamId: true, userId: true },
  })
  return leads
}

/** The departments this person leads; empty for everyone else. */
export async function ledTeamIds(organizationId: string, userId: string) {
  const rows = await db.teamLead.findMany({
    where: { organizationId, userId },
    select: { teamId: true },
  })
  return rows.map((row) => row.teamId)
}

export async function isTeamLead(organizationId: string, userId: string, teamId: string) {
  const row = await db.teamLead.findFirst({
    where: { organizationId, userId, teamId },
    select: { id: true },
  })
  return Boolean(row)
}

/** Idempotent: naming someone a lead twice is not an error the caller has to handle. */
export async function addLead(organizationId: string, teamId: string, userId: string) {
  const created = await db.teamLead.createMany({
    data: [{ organizationId, teamId, userId }],
    skipDuplicates: true,
  })
  return created.count > 0
}

export async function removeLead(organizationId: string, teamId: string, userId: string) {
  const removed = await db.teamLead.deleteMany({ where: { organizationId, teamId, userId } })
  return removed.count > 0
}
