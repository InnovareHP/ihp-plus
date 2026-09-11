import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  lookupOption: { findMany: vi.fn(), findFirst: vi.fn() },
  organization: { findMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
// membershipOf is pure, so the real one is kept: how a membership resolves has one definition.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))
vi.mock('@/lib/auth', () => ({ auth: { api: {} } }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))

const { loadOptions } = await import('./service')

function signedIn({ organizationId }: { organizationId?: string } = {}) {
  guard.getSession.mockResolvedValue({ user: { id: 'user-1' } })
  guard.readProfile.mockResolvedValue({
    role: 'user',
    members: organizationId ? [{ role: 'member', organizationId }] : [],
    teammembers: [],
  })
}

async function codeOf(operation: () => Promise<unknown>) {
  const error = await operation().catch((thrown: unknown) => thrown)
  return ConnectError.from(error).code
}

describe('loadOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedIn({ organizationId: 'org-1' })
    prisma.lookupOption.findMany.mockResolvedValue([{ value: 'Physician', sortOrder: 0 }])
    prisma.organization.findMany.mockResolvedValue([{ id: 'org-sole' }])
  })

  it('reads the list of the organization the caller belongs to', async () => {
    const options = await loadOptions('position')

    expect(options).toEqual([{ value: 'Physician', sortOrder: 0 }])
    expect(prisma.lookupOption.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-1', kind: 'position', archivedAt: null },
    })
    // A membership settles it, so the company is never looked up at all.
    expect(prisma.organization.findMany).not.toHaveBeenCalled()
  })

  it('falls back to the one company for someone still onboarding', async () => {
    signedIn()

    await loadOptions('position')

    expect(prisma.lookupOption.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-sole' },
    })
  })

  it('refuses to guess when more than one organization exists', async () => {
    signedIn()
    prisma.organization.findMany.mockResolvedValue([{ id: 'org-a' }, { id: 'org-b' }])

    expect(await codeOf(() => loadOptions('position'))).toBe(Code.FailedPrecondition)
    expect(prisma.lookupOption.findMany).not.toHaveBeenCalled()
  })

  it('refuses a kind that is not a curated list', async () => {
    expect(await codeOf(() => loadOptions('organizationRole'))).toBe(Code.InvalidArgument)
    expect(prisma.lookupOption.findMany).not.toHaveBeenCalled()
  })

  it('turns an anonymous caller away before touching the table', async () => {
    guard.getSession.mockResolvedValue(null)

    expect(await codeOf(() => loadOptions('position'))).toBe(Code.Unauthenticated)
    expect(prisma.lookupOption.findMany).not.toHaveBeenCalled()
  })
})
