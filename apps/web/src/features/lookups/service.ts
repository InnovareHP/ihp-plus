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
