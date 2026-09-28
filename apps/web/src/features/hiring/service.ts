import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { pageInfoOf, skipTake } from '@/lib/pagination'
import { requireHiringCaller, type HiringCaller } from './access'
import {
  DEFAULT_REJECTION_MESSAGE,
  DEFAULT_STAGES,
  hiringSettingsSchema,
  postingDraftSchema,
  publishBlockers,
  stagesSchema,
  type EmploymentType,
  type HiringSettings,
  type HiringSettingsValues,
  type PostingDraftValues,
  type PostingQuery,
  type PostingRow,
  type PostingsPage,
  type PostingStatus,
  type SalaryPeriod,
  type Stage,
  type Workplace,
} from './schema'
import { fieldsOf, stagesOf } from './utils/records'
import { slugOf } from './utils/slug'

async function teamNameMap(organizationId: string) {
  const teams = await db.team.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  })
  return new Map(teams.map((team) => [team.id, team.name]))
}

export async function loadSettings(): Promise<HiringSettings> {
  const caller = await requireHiringCaller()
  return settingsOf(caller)
}

async function settingsOf(caller: HiringCaller): Promise<HiringSettings> {
  const row = await db.hiringSettings.findUnique({
    where: { organizationId: caller.organizationId },
  })
  const team = row?.hrTeamId
    ? await db.team.findFirst({
        where: { id: row.hrTeamId, organizationId: caller.organizationId },
        select: { id: true, name: true },
      })
    : null
  const stored = stagesSchema.safeParse(row?.defaultStages)

  return {
    hrTeamId: team?.id,
    hrTeamName: team?.name,
    defaultStages: stored.success ? stored.data : [...DEFAULT_STAGES],
    rejectionMessage: row?.rejectionMessage || DEFAULT_REJECTION_MESSAGE,
    canEditHrTeam: caller.isAdmin,
  }
}

export async function saveSettings(input: HiringSettingsValues): Promise<HiringSettings> {
  const caller = await requireHiringCaller()
  const parsed = hiringSettingsSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError('Check the highlighted fields and try again.', Code.InvalidArgument)
  }
  const values = parsed.data

  const current = await db.hiringSettings.findUnique({
    where: { organizationId: caller.organizationId },
    select: { hrTeamId: true },
  })
  const requestedTeamId = values.hrTeamId || null
  let hrTeamId = current?.hrTeamId ?? null

  if (requestedTeamId !== hrTeamId) {
    // Picking the department is picking who may hire, which is an admin's call alone.
    if (!caller.isAdmin) {
      throw new ConnectError(
        'Only an admin can change which department runs hiring.',
        Code.PermissionDenied,
      )
    }
    if (requestedTeamId) {
      const team = await db.team.findFirst({
        where: { id: requestedTeamId, organizationId: caller.organizationId },
        select: { id: true },
      })
      if (!team) throw new ConnectError('That department no longer exists.', Code.NotFound)
    }
    hrTeamId = requestedTeamId
  }

  const data = {
    hrTeamId,
    defaultStages: values.defaultStages,
    rejectionMessage: values.rejectionMessage,
  }
  await db.hiringSettings.upsert({
    where: { organizationId: caller.organizationId },
    create: { organizationId: caller.organizationId, ...data },
    update: data,
  })

  return settingsOf(caller)
}

const POSTING_INCLUDE = {
  applicationForm: { select: { id: true, name: true, fields: true } },
} satisfies Prisma.JobPostingInclude

type PostingRecord = Prisma.JobPostingGetPayload<{ include: typeof POSTING_INCLUDE }>

interface PostingCounts {
  total: number
  active: number
  byStage: Record<string, number>
}

const NO_COUNTS: PostingCounts = { total: 0, active: 0, byStage: {} }

async function countsOf(postingIds: readonly string[]) {
  const counts = new Map<string, PostingCounts>()
  if (postingIds.length === 0) return counts

  const groups = await db.jobApplication.groupBy({
    by: ['postingId', 'status', 'stageId'],
    where: { postingId: { in: [...postingIds] } },
    _count: { _all: true },
  })

  for (const group of groups) {
    const entry = counts.get(group.postingId) ?? { total: 0, active: 0, byStage: {} }
    entry.total += group._count._all
    if (group.status === 'active') {
      entry.active += group._count._all
      entry.byStage[group.stageId] = (entry.byStage[group.stageId] ?? 0) + group._count._all
    }
    counts.set(group.postingId, entry)
  }
  return counts
}

export function postingRowOf(
  row: PostingRecord,
  teamNames: Map<string, string>,
  counts: PostingCounts = NO_COUNTS,
): PostingRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    location: row.location,
    workplace: row.workplace as Workplace,
    employmentType: row.employmentType as EmploymentType,
    salaryMin: row.salaryMin ?? undefined,
    salaryMax: row.salaryMax ?? undefined,
    salaryCurrency: row.salaryCurrency,
    salaryPeriod: row.salaryPeriod as SalaryPeriod,
    status: row.status as PostingStatus,
    resumeRequired: row.resumeRequired,
    stages: stagesOf(row.stages),
    applicationFormId: row.applicationForm?.id,
    applicationFormName: row.applicationForm?.name,
    applicationFields: row.applicationForm ? fieldsOf(row.applicationForm.fields) : [],
    teamId: row.teamId ?? undefined,
    teamName: row.teamId ? (teamNames.get(row.teamId) ?? 'Removed department') : undefined,
    openedAt: row.openedAt?.toISOString(),
    closesAt: row.closesAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    applicantCount: counts.total,
    activeCount: counts.active,
    stageCounts: counts.byStage,
  }
}

function statusWhere(status: PostingQuery['status']): Prisma.JobPostingWhereInput {
  return status === 'current' ? { status: { not: 'archived' } } : { status }
}

export async function loadPostingsPage(query: PostingQuery): Promise<PostingsPage> {
  const caller = await requireHiringCaller()

  const where: Prisma.JobPostingWhereInput = {
    organizationId: caller.organizationId,
    ...statusWhere(query.status),
    ...(query.teamIds.length > 0 ? { teamId: { in: query.teamIds } } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { location: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const total = await db.jobPosting.count({ where })
  const pageInfo = pageInfoOf({ page: query.page, pageSize: query.pageSize, total })

  const [rows, names] = await Promise.all([
    db.jobPosting.findMany({
      where,
      // Open first: those are the ones taking applications right now.
      orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
      include: POSTING_INCLUDE,
      ...skipTake(pageInfo),
    }),
    teamNameMap(caller.organizationId),
  ])
  const counts = await countsOf(rows.map((row) => row.id))

  return { rows: rows.map((row) => postingRowOf(row, names, counts.get(row.id))), pageInfo }
}

async function findPosting(caller: HiringCaller, postingId: string) {
  const row = await db.jobPosting.findFirst({
    where: { id: postingId, organizationId: caller.organizationId },
    include: POSTING_INCLUDE,
  })
  if (!row) throw new ConnectError('That job posting no longer exists.', Code.NotFound)
  return row
}

async function rowWithCounts(caller: HiringCaller, row: PostingRecord) {
  const [names, counts] = await Promise.all([
    teamNameMap(caller.organizationId),
    countsOf([row.id]),
  ])
  return postingRowOf(row, names, counts.get(row.id))
}

export async function loadPosting(postingId: string): Promise<PostingRow> {
  const caller = await requireHiringCaller()
  return rowWithCounts(caller, await findPosting(caller, postingId))
}

async function validApplicationFormId(organizationId: string, formId: string) {
  if (!formId) return null
  const form = await db.requestForm.findFirst({
    where: { id: formId, organizationId, kind: 'application', status: { not: 'archived' } },
    select: { id: true },
  })
  if (!form) throw new ConnectError('That application form is not available.', Code.NotFound)
  return form.id
}

async function validTeamId(organizationId: string, teamId: string) {
  if (!teamId) return null
  const team = await db.team.findFirst({
    where: { id: teamId, organizationId },
    select: { id: true },
  })
  if (!team) throw new ConnectError('That department no longer exists.', Code.NotFound)
  return team.id
}

export async function savePosting(input: PostingDraftValues): Promise<PostingRow> {
  const caller = await requireHiringCaller()
  const parsed = postingDraftSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError('Check the highlighted fields and try again.', Code.InvalidArgument)
  }
  const draft = parsed.data

  const [applicationFormId, teamId] = await Promise.all([
    validApplicationFormId(caller.organizationId, draft.applicationFormId),
    validTeamId(caller.organizationId, draft.teamId),
  ])

  const data = {
    title: draft.title,
    summary: draft.summary,
    description: draft.description,
    location: draft.location,
    workplace: draft.workplace,
    employmentType: draft.employmentType,
    salaryMin: draft.salaryMin === '' ? null : draft.salaryMin,
    salaryMax: draft.salaryMax === '' ? null : draft.salaryMax,
    salaryCurrency: draft.salaryCurrency.toUpperCase(),
    salaryPeriod: draft.salaryPeriod,
    resumeRequired: draft.resumeRequired,
    stages: draft.stages,
    applicationFormId,
    teamId,
    closesAt: draft.closesAt ? new Date(draft.closesAt) : null,
  }

  if (!draft.postingId) {
    const created = await db.jobPosting.create({
      data: {
        ...data,
        organizationId: caller.organizationId,
        createdById: caller.userId,
        slug: slugOf(draft.title, crypto.randomUUID()),
      },
      include: POSTING_INCLUDE,
    })
    return rowWithCounts(caller, created)
  }

  const existing = await findPosting(caller, draft.postingId)
  await refuseOrphanedStages(existing.id, draft.stages)

  const updated = await db.jobPosting.update({
    where: { id: existing.id },
    data,
    include: POSTING_INCLUDE,
  })
  return rowWithCounts(caller, updated)
}

// A stage someone is still sitting in cannot vanish from under them; they are moved first.
async function refuseOrphanedStages(postingId: string, stages: readonly Stage[]) {
  const kept = stages.map((stage) => stage.id)
  const stranded = await db.jobApplication.count({
    where: { postingId, status: 'active', stageId: { notIn: kept } },
  })
  if (stranded > 0) {
    throw new ConnectError(
      `${stranded} ${stranded === 1 ? 'applicant is' : 'applicants are'} still in a stage you removed — move them first.`,
      Code.FailedPrecondition,
    )
  }
}

export async function setPostingStatus(input: {
  postingId: string
  status: PostingStatus
}): Promise<PostingRow> {
  const caller = await requireHiringCaller()
  const existing = await findPosting(caller, input.postingId)

  if (input.status === 'open') {
    const blockers = publishBlockers({
      description: existing.description,
      stages: stagesOf(existing.stages),
    })
    if (blockers.length > 0) throw new ConnectError(blockers.join(' '), Code.FailedPrecondition)
  }
  // Only a draft goes back to being a draft: anything else has already been seen by the public.
  if (input.status === 'draft' && existing.status !== 'draft' && existing.openedAt) {
    throw new ConnectError(
      'This posting has already been public, so close or archive it instead.',
      Code.FailedPrecondition,
    )
  }

  const updated = await db.jobPosting.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      // The first time it goes up is when it opened; reopening keeps that date.
      ...(input.status === 'open' && !existing.openedAt ? { openedAt: new Date() } : {}),
    },
    include: POSTING_INCLUDE,
  })
  return rowWithCounts(caller, updated)
}

export async function deletePosting(postingId: string): Promise<void> {
  const caller = await requireHiringCaller()
  const existing = await findPosting(caller, postingId)
  const applications = await db.jobApplication.count({ where: { postingId: existing.id } })

  if (existing.status !== 'draft' || applications > 0) {
    throw new ConnectError(
      'This posting has already been public, so it can only be archived.',
      Code.FailedPrecondition,
    )
  }

  await db.jobPosting.delete({ where: { id: existing.id } })
}
