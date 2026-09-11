import { db } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { isLookupKind, type LookupKind, type LookupOptionRow } from './schema'

// Deliberately not requireOnboarded(): that redirects, and a redirect thrown inside an RPC
// surfaces as an opaque 500 rather than a code the caller can act on. Onboarding itself reads
// these lists, so the gate is a session, not a finished profile.
async function requireOrganization() {
  const session = await getSession()
  if (!session) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const profile = await readProfile(session.user.id)
  if (!profile) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const organizationId = membershipOf(profile).organizationId
  if (!organizationId) {
    // Someone signing up before any membership exists still has to pick a position.
    const fallback = await db.organization.findFirst({ select: { id: true } })
    if (!fallback) throw new ConnectError('No organization exists yet.', Code.FailedPrecondition)
    return fallback.id
  }

  return organizationId
}

export async function loadOptions(kind: string): Promise<LookupOptionRow[]> {
  if (!isLookupKind(kind)) {
    throw new ConnectError(`There is no "${kind}" list.`, Code.InvalidArgument)
  }

  const organizationId = await requireOrganization()
  return listFor(organizationId, kind)
}

export async function listFor(
  organizationId: string,
  kind: LookupKind,
): Promise<LookupOptionRow[]> {
  const rows = await db.lookupOption.findMany({
    where: { organizationId, kind, archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
    select: { value: true, sortOrder: true },
  })
  return rows
}

/**
 * The trust boundary for anything a lookup-backed dropdown wrote. An archived option still
 * passes: someone who chose it before it was retired must be able to save the rest of their
 * profile without silently losing the answer.
 */
export async function isKnownOption(organizationId: string, kind: LookupKind, value: string) {
  const row = await db.lookupOption.findFirst({
    where: { organizationId, kind, value },
    select: { id: true },
  })
  return Boolean(row)
}

/** One query for several dropdowns, so a screen full of them costs a single round trip. */
export async function listManyFor(organizationId: string, kinds: readonly LookupKind[]) {
  const rows = await db.lookupOption.findMany({
    where: { organizationId, kind: { in: [...kinds] }, archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
    select: { kind: true, value: true },
  })

  const grouped = new Map<LookupKind, string[]>(kinds.map((kind) => [kind, []]))
  for (const row of rows) grouped.get(row.kind as LookupKind)?.push(row.value)
  return grouped
}

/**
 * Bulk insert. skipDuplicates means re-adding a value the organization already has is a no-op
 * rather than an error, so a pasted list can safely overlap the existing one.
 */
export async function addOptions(
  organizationId: string,
  kind: LookupKind,
  values: readonly string[],
) {
  const last = await db.lookupOption.findFirst({
    where: { organizationId, kind },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const created = await db.lookupOption.createMany({
    data: values.map((value, index) => ({
      organizationId,
      kind,
      value,
      sortOrder: (last?.sortOrder ?? -1) + 1 + index,
    })),
    skipDuplicates: true,
  })

  return { added: created.count, skipped: values.length - created.count }
}

/** Retiring by value, not id: the caller is looking at a dropdown, which shows values. */
export async function retireOption(organizationId: string, kind: LookupKind, value: string) {
  const changed = await db.lookupOption.updateMany({
    where: { organizationId, kind, value, archivedAt: null },
    data: { archivedAt: new Date() },
  })
  return changed.count > 0
}
