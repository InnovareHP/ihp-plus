'use server'

import { db } from '@ihp/db'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { addLead, listLeads, removeLead } from './leads'
import { departmentLeadSchema, type DepartmentLeadsView } from './schema'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }
export type MutateResult = { ok: true } | { ok: false; message: string }

const FORBIDDEN = 'Only an admin can change who leads a department.'
const NO_ORGANIZATION = 'Your account is not part of an organization yet.'

async function caller() {
  const { profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  return {
    organizationId: membership.organizationId,
    canManage: canManageOrganization(membership),
  }
}

/** Read is open: knowing who leads a department is ordinary company information. */
export async function listDepartmentLeads(): Promise<Result<DepartmentLeadsView>> {
  const { organizationId } = await caller()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }

  const [teams, members, leads] = await Promise.all([
    db.team.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.member.findMany({
      where: { organizationId },
      orderBy: { user: { name: 'asc' } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    listLeads(organizationId),
  ])

  return {
    ok: true,
    data: {
      teams,
      members: members.map((member) => member.user),
      leads: leads.map((lead) => ({ teamId: lead.teamId, userId: lead.userId })),
    },
  }
}

export async function addDepartmentLead(input: unknown): Promise<MutateResult> {
  const { organizationId, canManage } = await caller()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }
  if (!canManage) return { ok: false, message: FORBIDDEN }

  const parsed = departmentLeadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Pick a department and a person.' }

  const team = await db.team.findFirst({
    where: { id: parsed.data.teamId, organizationId },
    select: { id: true },
  })
  if (!team) return { ok: false, message: 'That department no longer exists.' }

  const member = await db.member.findFirst({
    where: { organizationId, userId: parsed.data.userId },
    select: { id: true },
  })
  if (!member) return { ok: false, message: 'That person is not in this organization.' }

  await addLead(organizationId, parsed.data.teamId, parsed.data.userId)
  return { ok: true }
}

export async function removeDepartmentLead(input: unknown): Promise<MutateResult> {
  const { organizationId, canManage } = await caller()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }
  if (!canManage) return { ok: false, message: FORBIDDEN }

  const parsed = departmentLeadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Pick the lead to remove.' }

  const removed = await removeLead(organizationId, parsed.data.teamId, parsed.data.userId)
  if (!removed) return { ok: false, message: 'They do not lead that department.' }

  return { ok: true }
}
