import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { pageInfoOf, skipTake } from '@/lib/pagination'
import { objectUrl } from '@/lib/s3'
import type { RequestValues } from '@/features/requests/schema'
import { requireHiringCaller, type HiringCaller } from './access'
import { interviewsOf } from './interviews'
import { offerRecordsOf, offerRowOf } from './offers'
import { interviewsApplicant, scorecardsOf } from './scorecard-service'
import { requireMemberCaller } from './access'
import { notifyRejected, notifyStageMessage } from './notifications'
import {
  moveSchema,
  noteSchema,
  RESUME_FIELD_ID,
  rejectSchema,
  type ApplicationDetail,
  type ApplicationEventRow,
  type ApplicationQuery,
  type ApplicationsPage,
  type ApplicationStatus,
  type ApplicationSummary,
  type MoveValues,
  type NoteValues,
  type RejectValues,
  type Stage,
} from './schema'
import { statusUrl } from './status-link'
import { fieldsOf, stagesOf } from './utils/records'

// The board reads every applicant in progress at once; past this a posting needs the list view.
const PIPELINE_CAP = 500

const SUMMARY_INCLUDE = {
  posting: { select: { stages: true, title: true } },
  attachments: { where: { fieldId: RESUME_FIELD_ID }, select: { id: true }, take: 1 },
} satisfies Prisma.JobApplicationInclude

type SummaryRecord = Prisma.JobApplicationGetPayload<{ include: typeof SUMMARY_INCLUDE }>

function stageNameIn(stages: readonly Stage[], stageId: string) {
  return stages.find((stage) => stage.id === stageId)?.name ?? 'Removed stage'
}

function summaryOf(row: SummaryRecord): ApplicationSummary {
  return {
    id: row.id,
    postingId: row.postingId,
    postingTitle: row.posting.title,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    status: row.status as ApplicationStatus,
    stageId: row.stageId,
    stageName: stageNameIn(stagesOf(row.posting.stages), row.stageId),
    stageChangedAt: row.stageChangedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    hasResume: row.attachments.length > 0,
  }
}

function statusWhere(status: ApplicationQuery['status']): Prisma.JobApplicationWhereInput {
  return status === 'all' ? {} : { status }
}

export async function loadApplicationsPage(query: ApplicationQuery): Promise<ApplicationsPage> {
  const caller = await requireHiringCaller()

  const where: Prisma.JobApplicationWhereInput = {
    organizationId: caller.organizationId,
    ...statusWhere(query.status),
    ...(query.postingId ? { postingId: query.postingId } : {}),
    ...(query.stageId ? { stageId: query.stageId } : {}),
    ...(query.search
      ? {
          OR: [
            { fullName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const total = await db.jobApplication.count({ where })
  const pageInfo = pageInfoOf({ page: query.page, pageSize: query.pageSize, total })
  const rows = await db.jobApplication.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: SUMMARY_INCLUDE,
    ...skipTake(pageInfo),
  })

  return { rows: rows.map(summaryOf), pageInfo }
}

export async function loadPipeline(postingId: string): Promise<ApplicationSummary[]> {
  const caller = await requireHiringCaller()
  const rows = await db.jobApplication.findMany({
    where: { organizationId: caller.organizationId, postingId, status: 'active' },
    // Longest waiting first, so the people most at risk of being forgotten sit on top.
    orderBy: { stageChangedAt: 'asc' },
    include: SUMMARY_INCLUDE,
    take: PIPELINE_CAP,
  })
  return rows.map(summaryOf)
}

async function findApplication(caller: HiringCaller, applicationId: string) {
  const row = await db.jobApplication.findFirst({
    where: { id: applicationId, organizationId: caller.organizationId },
    include: {
      ...SUMMARY_INCLUDE,
      posting: { select: { stages: true, title: true, slug: true, teamId: true } },
    },
  })
  if (!row) throw new ConnectError('That application no longer exists.', Code.NotFound)
  return row
}

async function namesOf(userIds: readonly (string | null)[]) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return new Map<string, string>()
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, preferredName: true },
  })
  return new Map(users.map((user) => [user.id, user.preferredName ?? user.name]))
}

interface EventDetail {
  revised?: boolean
  toStageName?: string
  emailed?: boolean
  reason?: string
  existingMember?: boolean
  resent?: boolean
}

function detailOf(value: Prisma.JsonValue): EventDetail {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as EventDetail) : {}
}

// Labels are written when read, but from the names stored at the time, so a renamed stage
// does not rewrite what happened.
function eventRowOf(
  event: {
    id: string
    kind: string
    actorId: string | null
    detail: Prisma.JsonValue
    createdAt: Date
  },
  names: Map<string, string>,
): ApplicationEventRow {
  const detail = detailOf(event.detail)
  const labels: Record<string, string> = {
    applied: 'Applied through the careers page',
    moved: `Moved to ${detail.toStageName ?? 'another stage'}`,
    rejected: 'Not moving forward',
    reopened: 'Reopened',
    withdrawn: 'Withdrew their application',
    hired: detail.existingMember
      ? 'Hired from inside the organization'
      : detail.resent
        ? 'Sent the invitation again'
        : 'Hired and invited to join',
    joined: 'Accepted the invitation and joined',
    interview_offered: 'Offered interview times',
    interview_booked: 'Booked an interview time',
    interview_cancelled: 'Cancelled an interview',
    interview_reschedule_requested: 'Asked for other interview times',
    scorecard_submitted: 'Filled in a scorecard',
    offer_sent: detail.revised ? 'Sent a revised offer' : 'Sent an offer',
    offer_accepted: 'Accepted the offer',
    offer_declined: 'Declined the offer',
  }

  return {
    id: event.id,
    label: labels[event.kind] ?? event.kind,
    actorName: event.actorId ? (names.get(event.actorId) ?? 'Removed account') : undefined,
    detail:
      [detail.emailed ? 'Emailed the applicant' : undefined, detail.reason || undefined]
        .filter(Boolean)
        .join(' · ') || undefined,
    createdAt: event.createdAt.toISOString(),
  }
}

function valuesOf(value: Prisma.JsonValue): RequestValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const answers: RequestValues = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      answers[key] = entry
    }
  }
  return answers
}

export async function loadApplication(applicationId: string): Promise<ApplicationDetail> {
  const caller = await requireHiringCaller()
  const row = await findApplication(caller, applicationId)

  const [files, notes, events, invitation, interviews, scorecards, offers] = await Promise.all([
    db.applicationAttachment.findMany({
      where: { applicationId: row.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, fieldId: true, fileName: true, contentType: true, fileSize: true },
    }),
    db.applicationNote.findMany({
      where: { applicationId: row.id },
      orderBy: { createdAt: 'asc' },
    }),
    db.applicationEvent.findMany({
      where: { applicationId: row.id },
      orderBy: { createdAt: 'asc' },
    }),
    row.invitationId && !row.hiredUserId
      ? db.invitation.findUnique({
          where: { id: row.invitationId },
          select: { expiresAt: true, status: true },
        })
      : null,
    interviewsOf(row.id),
    scorecardsOf(row.id),
    offerRecordsOf(row.id),
  ])
  const names = await namesOf([
    ...notes.map((note) => note.authorId),
    ...events.map((event) => event.actorId),
    ...offers.map((offer) => offer.createdById),
  ])

  return {
    summary: summaryOf(row),
    fields: fieldsOf(row.fields),
    values: valuesOf(row.values),
    files,
    notes: notes.map((note) => ({
      id: note.id,
      authorId: note.authorId,
      authorName: names.get(note.authorId) ?? 'Removed account',
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      isMine: note.authorId === caller.userId,
    })),
    events: events.map((event) => eventRowOf(event, names)),
    stages: stagesOf(row.posting.stages),
    rejectionReason: row.rejectionReason ?? undefined,
    postingSlug: row.posting.slug,
    joined: Boolean(row.hiredUserId),
    // Only a link that still works is reported; anything else reads as expired.
    invitationExpiresAt:
      invitation?.status === 'pending' && invitation.expiresAt.getTime() > Date.now()
        ? invitation.expiresAt.toISOString()
        : undefined,
    postingTeamId: row.posting.teamId ?? undefined,
    interviews,
    scorecards,
    offers: offers.map((offer) => offerRowOf(offer, names)),
  }
}

async function organizationName(organizationId: string) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  return organization?.name ?? 'IHP+'
}

function requireActive(row: { status: string }) {
  if (row.status !== 'active') {
    throw new ConnectError(
      'This application has already been decided, so it can no longer move.',
      Code.FailedPrecondition,
    )
  }
}

async function reloadSummary(applicationId: string) {
  return summaryOf(
    await db.jobApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: SUMMARY_INCLUDE,
    }),
  )
}

export async function moveApplication(input: MoveValues): Promise<ApplicationSummary> {
  const caller = await requireHiringCaller()
  const parsed = moveSchema.safeParse(input)
  if (!parsed.success) throw new ConnectError('Pick a stage to move them to.', Code.InvalidArgument)
  const values = parsed.data

  const row = await findApplication(caller, values.applicationId)
  requireActive(row)
  const stage = stagesOf(row.posting.stages).find((candidate) => candidate.id === values.stageId)
  if (!stage) throw new ConnectError('That stage is no longer on this posting.', Code.NotFound)
  if (stage.id === row.stageId) {
    throw new ConnectError(`They are already in ${stage.name}.`, Code.FailedPrecondition)
  }

  const message = values.message || stage.message
  const emailed = values.sendEmail && message.length > 0

  await db.$transaction([
    db.jobApplication.update({
      where: { id: row.id },
      data: { stageId: stage.id, stageChangedAt: new Date() },
    }),
    db.applicationEvent.create({
      data: {
        applicationId: row.id,
        actorId: caller.userId,
        kind: 'moved',
        detail: { fromStageId: row.stageId, toStageId: stage.id, toStageName: stage.name, emailed },
      },
    }),
  ])

  if (emailed) {
    notifyStageMessage({
      applicationId: row.id,
      organizationName: await organizationName(caller.organizationId),
      fullName: row.fullName,
      email: row.email,
      postingTitle: row.postingTitle,
      message,
      statusUrl: statusUrl(row.id, row.createdAt),
    })
  }

  return reloadSummary(row.id)
}

export async function rejectApplication(input: RejectValues): Promise<ApplicationSummary> {
  const caller = await requireHiringCaller()
  const parsed = rejectSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError(
      parsed.error.issues[0]?.message ?? 'Check the rejection and try again.',
      Code.InvalidArgument,
    )
  }
  const values = parsed.data

  const row = await findApplication(caller, values.applicationId)
  requireActive(row)

  await db.$transaction([
    db.jobApplication.update({
      where: { id: row.id },
      data: {
        status: 'rejected',
        rejectionReason: values.reason || null,
        decidedById: caller.userId,
        decidedAt: new Date(),
      },
    }),
    db.applicationEvent.create({
      data: {
        applicationId: row.id,
        actorId: caller.userId,
        kind: 'rejected',
        detail: { reason: values.reason, emailed: values.sendEmail },
      },
    }),
  ])

  if (values.sendEmail) {
    notifyRejected({
      applicationId: row.id,
      organizationName: await organizationName(caller.organizationId),
      fullName: row.fullName,
      email: row.email,
      postingTitle: row.postingTitle,
      message: values.message,
    })
  }

  return reloadSummary(row.id)
}

export async function reopenApplication(applicationId: string): Promise<ApplicationSummary> {
  const caller = await requireHiringCaller()
  const row = await findApplication(caller, applicationId)
  // Only HR's own decision can be taken back; a withdrawal was the applicant's.
  if (row.status !== 'rejected') {
    throw new ConnectError('Only a rejected application can be reopened.', Code.FailedPrecondition)
  }

  await db.$transaction([
    db.jobApplication.update({
      where: { id: row.id },
      data: { status: 'active', rejectionReason: null, decidedById: null, decidedAt: null },
    }),
    db.applicationEvent.create({
      data: { applicationId: row.id, actorId: caller.userId, kind: 'reopened', detail: {} },
    }),
  ])

  return reloadSummary(row.id)
}

export async function addNote(input: NoteValues) {
  const caller = await requireHiringCaller()
  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) throw new ConnectError('Write the note first.', Code.InvalidArgument)

  const row = await findApplication(caller, parsed.data.applicationId)
  const note = await db.applicationNote.create({
    data: { applicationId: row.id, authorId: caller.userId, body: parsed.data.body },
  })

  return {
    id: note.id,
    authorId: note.authorId,
    authorName: caller.name,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
    isMine: true,
  }
}

export async function deleteNote(noteId: string) {
  const caller = await requireHiringCaller()
  const note = await db.applicationNote.findFirst({
    where: { id: noteId, application: { organizationId: caller.organizationId } },
    select: { id: true, authorId: true },
  })
  if (!note) throw new ConnectError('That note is no longer there.', Code.NotFound)
  if (note.authorId !== caller.userId) {
    throw new ConnectError('Only the person who wrote a note can delete it.', Code.PermissionDenied)
  }
  await db.applicationNote.delete({ where: { id: note.id } })
}

// HR opens any applicant's files; an interviewer only those of the people they interview.
export async function attachmentDownloadUrl(attachmentId: string): Promise<string> {
  const caller = await requireMemberCaller()
  const attachment = await db.applicationAttachment.findFirst({
    where: {
      id: attachmentId,
      organizationId: caller.organizationId,
      // An upload nobody sent is not part of any application, so it is not downloadable.
      applicationId: { not: null },
    },
    select: { fileKey: true, applicationId: true },
  })
  const allowed =
    attachment?.applicationId &&
    (caller.canHire || (await interviewsApplicant(caller.userId, attachment.applicationId)))
  if (!attachment || !allowed)
    throw new ConnectError('That file is no longer there.', Code.NotFound)
  return objectUrl(attachment.fileKey)
}
