import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  bluebookDocument: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    groupBy: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  team: { findMany: vi.fn(), findFirst: vi.fn() },
}))

const guard = vi.hoisted(() => ({
  requireOnboarded: vi.fn(),
  membershipOf: vi.fn((): { organizationId: string | undefined } => ({ organizationId: 'org-1' })),
  canManageOrganization: vi.fn(() => false),
}))

const leads = vi.hoisted(() => ({ ledTeamIds: vi.fn(async () => [] as string[]) }))
const lookups = vi.hoisted(() => ({ listManyFor: vi.fn(async () => new Map()) }))
const storage = vi.hoisted(() => ({
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  objectUrl: vi.fn(async () => 'https://files.example/signed'),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/auth-guard', () => guard)
vi.mock('@/features/teams/leads', () => leads)
vi.mock('@/features/lookups/service', () => lookups)
vi.mock('@/lib/s3', () => ({
  ...storage,
  S3NotConfiguredError: class S3NotConfiguredError extends Error {},
}))

const {
  archiveDocument,
  documentLink,
  listBluebookOptions,
  listDocuments,
  purgeDocument,
  updateDocument,
  uploadDocument,
} = await import('./actions')

const DOCUMENT = {
  id: 'doc-1',
  organizationId: 'org-1',
  teamId: 'team-1',
  teamName: 'Revenue Cycle',
  title: 'Claim scrubbing checklist',
  description: 'Run before submission.',
  category: 'Procedure',
  fileKey: 'bluebook/org-1/team-1/uuid-claim.pdf',
  fileName: 'claim.pdf',
  contentType: 'application/pdf',
  byteSize: 2048,
  uploadedById: 'user-9',
  uploadedByName: 'Grace Hopper',
  archivedAt: null,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
}

function signedIn(options: { isAdmin?: boolean; leads?: string[] } = {}) {
  guard.requireOnboarded.mockResolvedValue({
    user: { id: 'user-1', name: 'Ada Lovelace' },
    profile: {},
  })
  guard.membershipOf.mockReturnValue({ organizationId: 'org-1' })
  guard.canManageOrganization.mockReturnValue(options.isAdmin ?? false)
  leads.ledTeamIds.mockResolvedValue(options.leads ?? [])
}

function formDataFor(patch: Record<string, string> = {}, file?: File) {
  const form = new FormData()
  form.set('title', 'Time-off policy')
  form.set('description', 'Who approves what.')
  form.set('category', 'Policy')
  form.set('shelf', 'company')
  for (const [key, value] of Object.entries(patch)) form.set(key, value)
  form.set('file', file ?? new File(['x'.repeat(64)], 'policy.pdf', { type: 'application/pdf' }))
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  signedIn()
  prisma.bluebookDocument.count.mockResolvedValue(1)
  prisma.bluebookDocument.findMany.mockResolvedValue([DOCUMENT])
  prisma.bluebookDocument.findFirst.mockResolvedValue(DOCUMENT)
  prisma.bluebookDocument.groupBy.mockResolvedValue([{ teamId: 'team-1', _count: { _all: 3 } }])
  prisma.bluebookDocument.create.mockResolvedValue({ ...DOCUMENT, id: 'doc-2' })
  prisma.bluebookDocument.update.mockResolvedValue(DOCUMENT)
  prisma.team.findMany.mockResolvedValue([
    { id: 'team-1', name: 'Revenue Cycle' },
    { id: 'team-2', name: 'Care Management' },
  ])
  prisma.team.findFirst.mockResolvedValue({ id: 'team-1', name: 'Revenue Cycle' })
  lookups.listManyFor.mockResolvedValue(new Map([['bluebookCategory', ['Policy', 'Procedure']]]))
})

describe('listDocuments', () => {
  it('shows the whole bluebook to an ordinary member', async () => {
    const result = await listDocuments({})

    expect(prisma.bluebookDocument.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-1', archivedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: 0,
      take: 25,
    })
    expect(result).toMatchObject({ ok: true, rows: [{ id: 'doc-1', teamName: 'Revenue Cycle' }] })
  })

  it('marks rows the viewer may not manage, so the UI offers no dead controls', async () => {
    const asMember = await listDocuments({})
    expect(asMember).toMatchObject({ rows: [{ canManage: false }] })

    signedIn({ leads: ['team-1'] })
    expect(await listDocuments({})).toMatchObject({ rows: [{ canManage: true }] })

    signedIn({ isAdmin: true })
    expect(await listDocuments({})).toMatchObject({ rows: [{ canManage: true }] })
  })

  it('narrows to one shelf, the company-wide one included', async () => {
    await listDocuments({ shelf: 'company' })
    expect(prisma.bluebookDocument.findMany.mock.calls.at(-1)?.[0].where.AND).toEqual([
      { teamId: null },
    ])

    await listDocuments({ shelf: 'team-2' })
    expect(prisma.bluebookDocument.findMany.mock.calls.at(-1)?.[0].where.AND).toEqual([
      { teamId: 'team-2' },
    ])
  })

  it('searches the title, summary, file name and category', async () => {
    await listDocuments({ search: 'onboarding' })

    expect(prisma.bluebookDocument.findMany.mock.calls.at(-1)?.[0].where.AND).toEqual([
      {
        OR: [
          { title: { contains: 'onboarding', mode: 'insensitive' } },
          { description: { contains: 'onboarding', mode: 'insensitive' } },
          { fileName: { contains: 'onboarding', mode: 'insensitive' } },
          { category: { contains: 'onboarding', mode: 'insensitive' } },
        ],
      },
    ])
  })

  it('serves the archive as its own view', async () => {
    await listDocuments({ view: 'archived' })

    expect(prisma.bluebookDocument.findMany.mock.calls.at(-1)?.[0].where).toMatchObject({
      archivedAt: { not: null },
    })
  })
})

describe('listBluebookOptions', () => {
  it('offers every shelf with its count, and upload only where allowed', async () => {
    signedIn({ leads: ['team-2'] })

    const result = await listBluebookOptions()

    expect(result).toMatchObject({
      ok: true,
      data: {
        shelves: [
          // A lead may also contribute to the all-departments shelf.
          { value: 'company', label: 'All departments', canUpload: true },
          { value: 'team-1', label: 'Revenue Cycle', documentCount: 3, canUpload: false },
          { value: 'team-2', label: 'Care Management', documentCount: 0, canUpload: true },
        ],
        categories: ['Policy', 'Procedure'],
        isAdmin: false,
      },
    })
  })

  it('offers no upload at all to someone who leads nothing', async () => {
    const result = await listBluebookOptions()

    expect(result.ok && result.data.shelves.every((shelf) => !shelf.canUpload)).toBe(true)
  })
})

describe('uploadDocument', () => {
  it('refuses a member who leads no department, before touching storage', async () => {
    const result = await uploadDocument(formDataFor())

    expect(result).toMatchObject({ ok: false })
    expect(storage.putObject).not.toHaveBeenCalled()
    expect(prisma.bluebookDocument.create).not.toHaveBeenCalled()
  })

  it('refuses a lead filing on a department they do not lead', async () => {
    signedIn({ leads: ['team-2'] })

    expect(await uploadDocument(formDataFor({ shelf: 'team-1' }))).toMatchObject({ ok: false })
    expect(storage.putObject).not.toHaveBeenCalled()
  })

  it('lets a lead file on the all-departments shelf and snapshots the uploader', async () => {
    signedIn({ leads: ['team-2'] })

    const result = await uploadDocument(formDataFor())

    expect(storage.putObject).toHaveBeenCalledTimes(1)
    const [key, body, contentType] = storage.putObject.mock.calls[0] ?? []
    expect(key).toMatch(/^bluebook\/org-1\/company\/.+-policy\.pdf$/)
    expect(body).toBeInstanceOf(Uint8Array)
    expect(contentType).toBe('application/pdf')
    expect(prisma.bluebookDocument.create.mock.calls[0]?.[0].data).toMatchObject({
      organizationId: 'org-1',
      teamId: null,
      teamName: null,
      title: 'Time-off policy',
      category: 'Policy',
      fileName: 'policy.pdf',
      byteSize: 64,
      uploadedById: 'user-1',
      uploadedByName: 'Ada Lovelace',
    })
    expect(result).toMatchObject({ ok: true })
  })

  it('names the department on a department shelf, so a rename later still reads', async () => {
    signedIn({ isAdmin: true })

    await uploadDocument(formDataFor({ shelf: 'team-1' }))

    expect(prisma.bluebookDocument.create.mock.calls[0]?.[0].data).toMatchObject({
      teamId: 'team-1',
      teamName: 'Revenue Cycle',
    })
  })

  it('refuses a file type the handbook does not take', async () => {
    signedIn({ isAdmin: true })
    const bad = new File(['x'], 'installer.exe', { type: 'application/x-msdownload' })

    expect(await uploadDocument(formDataFor({}, bad))).toEqual({
      ok: false,
      message: 'Upload a PDF, Office document, text file or image.',
    })
    expect(storage.putObject).not.toHaveBeenCalled()
  })

  it('writes no row when storage rejects the file', async () => {
    signedIn({ isAdmin: true })
    storage.putObject.mockRejectedValue(new Error('bucket down'))

    expect(await uploadDocument(formDataFor())).toMatchObject({ ok: false })
    expect(prisma.bluebookDocument.create).not.toHaveBeenCalled()
  })
})

describe('updateDocument', () => {
  const values = {
    id: 'doc-1',
    title: 'Claim scrubbing checklist',
    description: '',
    category: 'Procedure',
    shelf: 'team-1',
  }

  it('checks both ends of a move: the shelf it leaves and the one it joins', async () => {
    signedIn({ leads: ['team-1'] })
    prisma.team.findFirst.mockResolvedValue({ id: 'team-2', name: 'Care Management' })

    // Leading the source department is not enough to file into another one.
    expect(await updateDocument({ ...values, shelf: 'team-2' })).toMatchObject({ ok: false })
    expect(prisma.bluebookDocument.update).not.toHaveBeenCalled()
  })

  it('lets the shelf lead edit the details', async () => {
    signedIn({ leads: ['team-1'] })

    expect(await updateDocument(values)).toMatchObject({ ok: true })
    expect(prisma.bluebookDocument.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'doc-1' },
      data: { title: 'Claim scrubbing checklist', description: null, category: 'Procedure' },
    })
  })

  it('says so when the document is gone', async () => {
    signedIn({ isAdmin: true })
    prisma.bluebookDocument.findFirst.mockResolvedValue(null)

    expect(await updateDocument(values)).toEqual({
      ok: false,
      message: 'That document is no longer in the bluebook.',
    })
  })
})

describe('archiveDocument', () => {
  it('refuses anyone who is not the shelf lead or an admin', async () => {
    expect(await archiveDocument({ id: 'doc-1' })).toMatchObject({ ok: false })
    expect(prisma.bluebookDocument.update).not.toHaveBeenCalled()
  })

  it('stamps archivedAt for the shelf lead', async () => {
    signedIn({ leads: ['team-1'] })

    expect(await archiveDocument({ id: 'doc-1' })).toMatchObject({ ok: true })
    expect(prisma.bluebookDocument.update.mock.calls[0]?.[0].data.archivedAt).toBeInstanceOf(Date)
  })
})

describe('purgeDocument', () => {
  it('is closed to a department lead', async () => {
    signedIn({ leads: ['team-1'] })

    expect(await purgeDocument({ id: 'doc-1' })).toEqual({
      ok: false,
      message: 'Only an admin can delete a file for good.',
    })
  })

  it('refuses to delete something still on a shelf', async () => {
    signedIn({ isAdmin: true })

    expect(await purgeDocument({ id: 'doc-1' })).toEqual({
      ok: false,
      message: 'Archive it first — deleting is not reversible.',
    })
    expect(storage.deleteObject).not.toHaveBeenCalled()
  })

  it('removes the stored file and the row once archived', async () => {
    signedIn({ isAdmin: true })
    prisma.bluebookDocument.findFirst.mockResolvedValue({
      id: 'doc-1',
      fileKey: DOCUMENT.fileKey,
      archivedAt: new Date(),
    })

    expect(await purgeDocument({ id: 'doc-1' })).toMatchObject({ ok: true })
    expect(storage.deleteObject).toHaveBeenCalledWith(DOCUMENT.fileKey)
    expect(prisma.bluebookDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
  })
})

describe('documentLink', () => {
  it('mints a signed link for any member, without handing over the key', async () => {
    const result = await documentLink({ id: 'doc-1' })

    expect(storage.objectUrl).toHaveBeenCalledWith(DOCUMENT.fileKey)
    expect(result).toEqual({ ok: true, data: { url: 'https://files.example/signed' } })
  })

  it('refuses an id from another organization', async () => {
    prisma.bluebookDocument.findFirst.mockResolvedValue(null)

    expect(await documentLink({ id: 'doc-x' })).toMatchObject({ ok: false })
    expect(storage.objectUrl).not.toHaveBeenCalled()
  })
})
