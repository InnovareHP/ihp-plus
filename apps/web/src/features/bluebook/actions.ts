'use server'

import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
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

/**
 * A document on several shelves is managed by an admin, or by a lead of any one of them — a
 * Finance lead curates what sits on Finance's shelf, whoever else it is also filed for.
 */
function canManageDocument(who: Caller, teamIds: readonly string[]) {
  if (who.isAdmin) return true
  if (teamIds.length === 0) return canFileOn(who, COMPANY_SHELF)
  return teamIds.some((teamId) => who.leadTeamIds.includes(teamId))
}

/**
 * Which shelves a non-admin may add or remove. Shelves they do not lead have to be left as
 * they are, so a Finance lead editing a shared document cannot quietly pull it off
 * Compliance's shelf — or push it onto one.
 */
function shelfChangesAllowed(who: Caller, current: readonly string[], next: readonly string[]) {
  if (who.isAdmin) return true

  const added = next.filter((teamId) => !current.includes(teamId))
  const removed = current.filter((teamId) => !next.includes(teamId))
  return [...added, ...removed].every((teamId) => canFileOn(who, teamId))
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
  // A document filed on several shelves shows under each of them.
  if (query.shelf === COMPANY_SHELF) clauses.push({ teams: { none: {} } })
  else if (query.shelf !== '') clauses.push({ teams: { some: { teamId: query.shelf } } })

  return clauses.length > 0 ? { ...where, AND: clauses } : where
}

const ORDER_BY: Record<
  BluebookSortKey,
  (direction: SortDirection) => Prisma.BluebookDocumentOrderByWithRelationInput
> = {
  title: (direction) => ({ title: direction }),
  category: (direction) => ({ category: direction }),
  byteSize: (direction) => ({ byteSize: direction }),
  createdAt: (direction) => ({ createdAt: direction }),
}

const WITH_TEAMS = {
  teams: { select: { teamId: true, teamName: true }, orderBy: { teamName: 'asc' } },
} satisfies Prisma.BluebookDocumentInclude

type DocumentRecord = Prisma.BluebookDocumentGetPayload<{ include: typeof WITH_TEAMS }>

interface ReadState {
  acknowledgedAt: Date | undefined
  readCount: number
  audienceCount: number
}

function rowOf(document: DocumentRecord, who: Caller, reads?: ReadState): DocumentRow {
  const teams = document.teams.map((team) => ({ id: team.teamId, name: team.teamName }))
  const canManage = canManageDocument(
    who,
    teams.map((team) => team.id),
  )

  return {
    id: document.id,
    title: document.title,
    description: document.description ?? '',
    category: document.category ?? '',
    teams,
    fileName: document.fileName,
    contentType: document.contentType,
    byteSize: document.byteSize,
    uploadedByName: document.uploadedByName ?? '',
    createdAt: document.createdAt.toISOString(),
    archivedAt: document.archivedAt?.toISOString(),
    canManage,
    acknowledgedAt: reads?.acknowledgedAt?.toISOString(),
    // Read progress is the curator's view; everyone else only sees whether they read it.
    readCount: canManage ? reads?.readCount : undefined,
    audienceCount: canManage ? reads?.audienceCount : undefined,
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
    include: WITH_TEAMS,
    // The second key is the tiebreaker: without it equal values reshuffle between pages.
    orderBy: [ORDER_BY[query.sortBy](query.sortDirection), { id: 'asc' }],
    ...skipTake(pageInfo),
  })

  const reads = await readStates(who.userId, who.organizationId, documents)

  return {
    ok: true,
    pageInfo,
    rows: documents.map((document) => rowOf(document, who, reads.get(document.id))),
  }
}

/** The viewer's own reads and each document's read progress, in four queries for the page. */
async function readStates(
  userId: string,
  organizationId: string,
  documents: readonly DocumentRecord[],
): Promise<Map<string, ReadState>> {
  const ids = documents.map((document) => document.id)
  if (ids.length === 0) return new Map()

  const [mine, counts, companySize, teams] = await Promise.all([
    db.bluebookAcknowledgement.findMany({
      where: { documentId: { in: ids }, userId },
      select: { documentId: true, acknowledgedAt: true },
    }),
    db.bluebookAcknowledgement.groupBy({
      by: ['documentId'],
      where: { documentId: { in: ids } },
      _count: { _all: true },
    }),
    db.member.count({
      where: { organizationId, user: { onboardingCompletedAt: { not: null } } },
    }),
    db.team.findMany({
      where: { organizationId },
      select: { id: true, _count: { select: { teammembers: true } } },
    }),
  ])

  const readAt = new Map(mine.map((row) => [row.documentId, row.acknowledgedAt]))
  const readCounts = new Map(counts.map((row) => [row.documentId, row._count._all]))
  const teamSizes = new Map(teams.map((team) => [team.id, team._count.teammembers]))

  return new Map(
    documents.map((document): [string, ReadState] => [
      document.id,
      {
        acknowledgedAt: readAt.get(document.id),
        readCount: readCounts.get(document.id) ?? 0,
        // The company shelf is everyone's reading; a department shelf is its members'.
        audienceCount:
          document.teams.length === 0
            ? companySize
            : document.teams.reduce((total, team) => total + (teamSizes.get(team.teamId) ?? 0), 0),
      },
    ]),
  )
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
    // One document counts on every shelf it sits on, which is the point of the count.
    db.bluebookDocumentTeam.groupBy({
      by: ['teamId'],
      where: { document: { organizationId, archivedAt: null } },
      _count: { _all: true },
    }),
    db.bluebookDocument.count({
      where: { organizationId, archivedAt: null, teams: { none: {} } },
    }),
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
    // Repeated fields rather than one joined string, so a department name can hold anything.
    shelves: formData.getAll('shelves'),
  })
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields and try again.' }
  if (!parsed.data.shelves.every((shelf) => canFileOn(who, shelf))) {
    return { ok: false, message: FORBIDDEN }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, message: 'Choose a file to upload.' }

  const problem = fileProblem({ name: file.name, size: file.size, type: file.type })
  if (problem) return { ok: false, message: problem }

  const teams = await teamsFor(who.organizationId, parsed.data.shelves)
  if (!teams) return { ok: false, message: 'One of those departments no longer exists.' }

  const key = keyFor(who.organizationId, parsed.data.shelves[0] ?? COMPANY_SHELF, file.name)

  try {
    await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type)
  } catch (error) {
    if (error instanceof S3NotConfiguredError) return { ok: false, message: NO_STORAGE }
    return { ok: false, message: 'Could not store that file — try again.' }
  }

  const document = await db.bluebookDocument.create({
    data: {
      organizationId: who.organizationId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      fileKey: key,
      fileName: file.name,
      contentType: file.type,
      byteSize: file.size,
      uploadedById: who.userId,
      uploadedByName: who.userName,
      teams: {
        create: teams.map((team) => ({ teamId: team.id, teamName: team.name })),
      },
    },
    include: WITH_TEAMS,
  })

  return { ok: true, data: rowOf(document, who) }
}

/**
 * The departments behind a set of shelf values, or undefined if any of them has been deleted.
 * COMPANY_SHELF resolves to no departments, which is how the all-departments shelf is stored.
 */
async function teamsFor(organizationId: string, shelves: readonly string[]) {
  const ids = shelves.filter((shelf) => shelf !== COMPANY_SHELF)
  if (ids.length === 0) return []

  const teams = await db.team.findMany({
    where: { id: { in: [...ids] }, organizationId },
    select: { id: true, name: true },
  })
  return teams.length === ids.length ? teams : undefined
}

/** Metadata only: a new file is a new upload, so a download link never changes underneath. */
export async function updateDocument(input: unknown): Promise<Result<DocumentRow>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = updateDocumentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields and try again.' }

  const current = await db.bluebookDocument.findFirst({
    where: { id: parsed.data.id, organizationId: who.organizationId },
    include: WITH_TEAMS,
  })
  if (!current) return { ok: false, message: GONE }

  const teams = await teamsFor(who.organizationId, parsed.data.shelves)
  if (!teams) return { ok: false, message: 'One of those departments no longer exists.' }

  const currentIds = current.teams.map((team) => team.teamId)
  const nextIds = teams.map((team) => team.id)

  // Both ends are checked: filing onto a shelf is the permission being spent, and taking a
  // document off one is too.
  if (
    !canManageDocument(who, currentIds) ||
    !shelfChangesAllowed(who, currentIds, nextIds) ||
    (nextIds.length === 0 && !canFileOn(who, COMPANY_SHELF))
  ) {
    return { ok: false, message: FORBIDDEN }
  }

  const document = await db.$transaction(async (tx) => {
    // Replaced rather than diffed: the picker always sends the whole set.
    await tx.bluebookDocumentTeam.deleteMany({ where: { documentId: current.id } })

    return tx.bluebookDocument.update({
      where: { id: current.id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        category: parsed.data.category || null,
        teams: { create: teams.map((team) => ({ teamId: team.id, teamName: team.name })) },
      },
      include: WITH_TEAMS,
    })
  })

  return { ok: true, data: rowOf(document, who) }
}

export async function archiveDocument(input: unknown): Promise<Result<null>> {
  return setArchived(input, new Date())
}

export async function restoreDocument(input: unknown): Promise<Result<null>> {
  return setArchived(input, null)
}

/** The viewer confirms they have read a document; confirming twice still records one read. */
export async function acknowledgeDocument(
  input: unknown,
): Promise<Result<{ acknowledgedAt: string }>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = documentIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: GONE }

  // Everyone reads the whole bluebook, so the only check is that it is live and in this company.
  const document = await db.bluebookDocument.findFirst({
    where: { id: parsed.data.id, organizationId: who.organizationId, archivedAt: null },
    select: { id: true },
  })
  if (!document) return { ok: false, message: GONE }

  const acknowledgement = await db.bluebookAcknowledgement.upsert({
    where: { documentId_userId: { documentId: document.id, userId: who.userId } },
    update: {},
    create: { documentId: document.id, userId: who.userId },
    select: { acknowledgedAt: true },
  })

  return { ok: true, data: { acknowledgedAt: acknowledgement.acknowledgedAt.toISOString() } }
}

async function setArchived(input: unknown, archivedAt: Date | null): Promise<Result<null>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = documentIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: GONE }

  const current = await db.bluebookDocument.findFirst({
    where: { id: parsed.data.id, organizationId: who.organizationId },
    select: { id: true, teams: { select: { teamId: true } } },
  })
  if (!current) return { ok: false, message: GONE }

  const teamIds = current.teams.map((team) => team.teamId)
  if (!canManageDocument(who, teamIds)) return { ok: false, message: FORBIDDEN }

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
