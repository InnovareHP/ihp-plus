'use server'

import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { addOptions, listManyFor, retireOption } from './service'
import {
  addLookupOptionsSchema,
  isLookupKind,
  retireLookupOptionSchema,
  type LookupKind,
  type LookupOptionLists,
} from './schema'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }

const FORBIDDEN = 'Only an admin can change a dropdown list.'
const NO_ORGANIZATION = 'Your account is not part of an organization yet.'

async function caller() {
  const { user, profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  return {
    userId: user.id,
    organizationId: membership.organizationId,
    canManage: canManageOrganization(membership),
  }
}

/** Reading a list is open to everyone: the dropdowns are on forms everyone fills in. */
export async function listLookupOptions(kinds: unknown): Promise<Result<LookupOptionLists>> {
  const { organizationId } = await caller()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }

  const wanted = Array.isArray(kinds)
    ? kinds.filter((kind): kind is LookupKind => isLookupKind(String(kind)))
    : []
  if (wanted.length === 0) return { ok: false, message: 'Name at least one list to read.' }

  const grouped = await listManyFor(organizationId, wanted)
  const lists: LookupOptionLists = {}
  for (const kind of wanted) lists[kind] = grouped.get(kind) ?? []

  return { ok: true, data: lists }
}

/** Bulk insert; curating a list is an admin job, whoever fills in the form that reads it. */
export async function addLookupOptions(
  input: unknown,
): Promise<Result<{ added: number; skipped: number }>> {
  const { organizationId, canManage } = await caller()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }
  if (!canManage) return { ok: false, message: FORBIDDEN }

  const parsed = addLookupOptionsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Paste at least one value to add.' }

  const counts = await addOptions(organizationId, parsed.data.kind, parsed.data.values)
  return { ok: true, data: counts }
}

export async function retireLookupOption(input: unknown): Promise<Result<null>> {
  const { organizationId, canManage } = await caller()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }
  if (!canManage) return { ok: false, message: FORBIDDEN }

  const parsed = retireLookupOptionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Pick a value to retire.' }

  const retired = await retireOption(organizationId, parsed.data.kind, parsed.data.value)
  if (!retired) return { ok: false, message: 'That value is already retired.' }

  return { ok: true, data: null }
}
