'use server'

import { db } from '@ihp/db'
import type { BluebookDocument, Prisma } from '@ihp/db'
import { listManyFor } from '@/features/lookups/service'
import { ledTeamIds } from '@/features/teams/leads'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { pageInfoOf, skipTake, type SortDirection } from '@/lib/pagination'
import { deleteObject, objectUrl, putObject, S3NotConfiguredError } from '@/lib/s3'
import {
  bluebookQuerySchema,
  BLUEBOOK_LOOKUP_KINDS,
  COMPANY_SHELF,
  documentDraftSchema,
  documentIdSchema,
  fileProblem,
  updateDocumentSchema,
  type BluebookOptions,
  type BluebookQuery,
  type BluebookSortKey,
  type DocumentRow,
  type DocumentsPage,
} from './schema'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }
export type DocumentsResult = ({ ok: true } & DocumentsPage) | { ok: false; message: string }

const NO_ORGANIZATION = 'Your account is not part of an organization yet.'
const FORBIDDEN = 'Only an admin or that department’s lead can file documents there.'
const GONE = 'That document is no longer in the bluebook.'
const NO_STORAGE = 'File storage is not configured yet — tell an admin to set the S3 variables.'

/**
 * Everyone in the company reads the whole bluebook; filing is what is restricted. An admin may
 * file anywhere, a department lead on their own shelves and the all-departments one.
 */
async function caller() {
  const { user, profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  const organizationId = membership.organizationId
  const leadTeamIds = organizationId ? await ledTeamIds(organizationId, user.id) : []

  return {
    userId: user.id,
    userName: user.name,
    organizationId,
    isAdmin: canManageOrganization(membership),
    leadTeamIds,
  }
}

type Caller = Awaited<ReturnType<typeof caller>>

function canFileOn(who: Caller, shelf: string) {
  if (who.isAdmin) return true
  // A lead curates their own department and may also contribute to the company-wide shelf.
  if (shelf === COMPANY_SHELF) return who.leadTeamIds.length > 0
  return who.leadTeamIds.includes(shelf)
}

function shelfOf(row: { teamId: string | null }) {
  return row.teamId ?? COMPANY_SHELF
}

const SEARCH_FIELDS = ['title', 'description', 'fileName', 'category'] as const

function whereOf(organizationId: string, query: BluebookQuery): Prisma.BluebookDocumentWhereInput {
  const where: Prisma.BluebookDocumentWhereInput = {
    organizationId,
    archivedAt: query.view === 'archived' ? { not: null } : null,
  }
  const clauses: Prisma.BluebookDocumentWhereInput[] = []

  if (query.search) {
    clauses.push({
      OR: SEARCH_FIELDS.map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      })),
    })
  }

  if (query.categories.length > 0) clauses.push({ category: { in: query.categories } })
  if (query.shelf === COMPANY_SHELF) clauses.push({ teamId: null })
  else if (query.shelf !== '') clauses.push({ teamId: query.shelf })

  return clauses.length > 0 ? { ...where, AND: clauses } : where
}

const ORDER_BY: Record<
  BluebookSortKey,
  (direction: SortDirection) => Prisma.BluebookDocumentOrderByWithRelationInput
> = {
  title: (direction) => ({ title: direction }),
  category: (direction) => ({ category: direction }),
  teamName: (direction) => ({ teamName: direction }),
  byteSize: (direction) => ({ byteSize: direction }),
  createdAt: (direction) => ({ createdAt: direction }),
}

function rowOf(document: BluebookDocument, who: Caller): DocumentRow {
  return {
    id: document.id,
    title: document.title,
    description: document.description ?? '',
    category: document.category ?? '',
    teamId: document.teamId ?? '',
    teamName: document.teamName ?? '',
    fileName: document.fileName,
    contentType: document.contentType,
    byteSize: document.byteSize,
    uploadedByName: document.uploadedByName ?? '',
    createdAt: document.createdAt.toISOString(),
    archivedAt: document.archivedAt?.toISOString(),
    canManage: canFileOn(who, shelfOf(document)),
  }
}

export async function listDocuments(input?: unknown): Promise<DocumentsResult> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const query = bluebookQuerySchema.parse(input ?? {})
  const where = whereOf(who.organizationId, query)

  const total = await db.bluebookDocument.count({ where })
  // Counted first so a stale ?page= past the end lands on the last page instead of a blank shelf.
  const pageInfo = pageInfoOf({ page: query.page, pageSize: query.pageSize, total })

  const documents = await db.bluebookDocument.findMany({
    where,
    // The second key is the tiebreaker: without it equal values reshuffle between pages.
    orderBy: [ORDER_BY[query.sortBy](query.sortDirection), { id: 'asc' }],
    ...skipTake(pageInfo),
  })

  return { ok: true, pageInfo, rows: documents.map((document) => rowOf(document, who)) }
}

/** The shelves this viewer can see and file on, plus the category list. */
export async function listBluebookOptions(): Promise<Result<BluebookOptions>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }
  const organizationId = who.organizationId

  const [teams, counts, companyCount, lists] = await Promise.all([
    db.team.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.bluebookDocument.groupBy({
      by: ['teamId'],
      where: { organizationId, archivedAt: null, teamId: { not: null } },
      _count: { _all: true },
    }),
    db.bluebookDocument.count({ where: { organizationId, archivedAt: null, teamId: null } }),
    listManyFor(organizationId, BLUEBOOK_LOOKUP_KINDS),
  ])

  const byTeam = new Map(counts.map((row) => [row.teamId, row._count._all]))

  return {
    ok: true,
    data: {
      shelves: [
        {
          value: COMPANY_SHELF,
          label: 'All departments',
          documentCount: companyCount,
          canUpload: canFileOn(who, COMPANY_SHELF),
        },
        ...teams.map((team) => ({
          value: team.id,
          label: team.name,
          documentCount: byTeam.get(team.id) ?? 0,
          canUpload: canFileOn(who, team.id),
        })),
      ],
      categories: lists.get('bluebookCategory') ?? [],
      isAdmin: who.isAdmin,
    },
  }
}

/** A safe object key: the original name is kept for the download, not for storage. */
function keyFor(organizationId: string, shelf: string, fileName: string) {
  const safe = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '')
  return `bluebook/${organizationId}/${shelf}/${crypto.randomUUID()}-${safe.slice(-80)}`
}

export async function uploadDocument(formData: FormData): Promise<Result<DocumentRow>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = documentDraftSchema.safeParse({
    title: formData.get('title') ?? '',
    description: formData.get('description') ?? '',
    category: formData.get('category') ?? '',
    shelf: formData.get('shelf') ?? '',
  })
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields and try again.' }
  if (!canFileOn(who, parsed.data.shelf)) return { ok: false, message: FORBIDDEN }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, message: 'Choose a file to upload.' }

  const problem = fileProblem({ name: file.name, size: file.size, type: file.type })
  if (problem) return { ok: false, message: problem }

  const team = await teamFor(who.organizationId, parsed.data.shelf)
  if (parsed.data.shelf !== COMPANY_SHELF && !team) {
    return { ok: false, message: 'That department no longer exists.' }
  }

  const key = keyFor(who.organizationId, parsed.data.shelf, file.name)

  try {
    await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type)
  } catch (error) {
    if (error instanceof S3NotConfiguredError) return { ok: false, message: NO_STORAGE }
    return { ok: false, message: 'Could not store that file — try again.' }
  }

  const document = await db.bluebookDocument.create({
    data: {
      organizationId: who.organizationId,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      fileKey: key,
      fileName: file.name,
      contentType: file.type,
      byteSize: file.size,
      uploadedById: who.userId,
      uploadedByName: who.userName,
    },
  })

  return { ok: true, data: rowOf(document, who) }
}

async function teamFor(organizationId: string, shelf: string) {
  if (shelf === COMPANY_SHELF) return null
  return db.team.findFirst({
    where: { id: shelf, organizationId },
    select: { id: true, name: true },
  })
}

/** Metadata only: a new file is a new upload, so a download link never changes underneath. */
export async function updateDocument(input: unknown): Promise<Result<DocumentRow>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = updateDocumentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields and try again.' }

  const current = await db.bluebookDocument.findFirst({
    where: { id: parsed.data.id, organizationId: who.organizationId },
  })
  if (!current) return { ok: false, message: GONE }

  // Both ends of a move are checked: filing into a shelf is the permission being spent.
  if (!canFileOn(who, shelfOf(current)) || !canFileOn(who, parsed.data.shelf)) {
    return { ok: false, message: FORBIDDEN }
  }

  const team = await teamFor(who.organizationId, parsed.data.shelf)
  if (parsed.data.shelf !== COMPANY_SHELF && !team) {
    return { ok: false, message: 'That department no longer exists.' }
  }

  const document = await db.bluebookDocument.update({
    where: { id: current.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
    },
  })

  return { ok: true, data: rowOf(document, who) }
}

export async function archiveDocument(input: unknown): Promise<Result<null>> {
  return setArchived(input, new Date())
}

export async function restoreDocument(input: unknown): Promise<Result<null>> {
  return setArchived(input, null)
}

async function setArchived(input: unknown, archivedAt: Date | null): Promise<Result<null>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = documentIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: GONE }

  const current = await db.bluebookDocument.findFirst({
    where: { id: parsed.data.id, organizationId: who.organizationId },
    select: { id: true, teamId: true },
  })
  if (!current) return { ok: false, message: GONE }
  if (!canFileOn(who, shelfOf(current))) return { ok: false, message: FORBIDDEN }

  await db.bluebookDocument.update({ where: { id: current.id }, data: { archivedAt } })
  return { ok: true, data: null }
}

/** Deleting the file for real. Admin only, and only from the archive. */
export async function purgeDocument(input: unknown): Promise<Result<null>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }
  if (!who.isAdmin) return { ok: false, message: 'Only an admin can delete a file for good.' }

  const parsed = documentIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: GONE }

  const current = await db.bluebookDocument.findFirst({
    where: { id: parsed.data.id, organizationId: who.organizationId },
    select: { id: true, fileKey: true, archivedAt: true },
  })
  if (!current) return { ok: false, message: GONE }
  if (!current.archivedAt) {
    return { ok: false, message: 'Archive it first — deleting is not reversible.' }
  }

  try {
    await deleteObject(current.fileKey)
  } catch (error) {
    if (!(error instanceof S3NotConfiguredError)) {
      return { ok: false, message: 'Could not remove the stored file — try again.' }
    }
  }

  await db.bluebookDocument.delete({ where: { id: current.id } })
  return { ok: true, data: null }
}

/** A short-lived link, minted per click: the key itself never reaches the browser. */
export async function documentLink(input: unknown): Promise<Result<{ url: string }>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = documentIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: GONE }

  const document = await db.bluebookDocument.findFirst({
    where: { id: parsed.data.id, organizationId: who.organizationId },
    select: { fileKey: true },
  })
  if (!document) return { ok: false, message: GONE }

  try {
    return { ok: true, data: { url: await objectUrl(document.fileKey) } }
  } catch (error) {
    if (error instanceof S3NotConfiguredError) return { ok: false, message: NO_STORAGE }
    return { ok: false, message: 'Could not open that file — try again.' }
  }
}
