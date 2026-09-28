import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { answerSchemaOf, pruneAnswers, type RequestValues } from '@/features/requests/schema'
import { requireMemberCaller, type MemberCaller } from './access'
import { INTERVIEW_INCLUDE, interviewersById, interviewRowOf } from './interviews'
import {
  DEFAULT_TIME_ZONE,
  RECOMMENDATIONS,
  RESUME_FIELD_ID,
  type ApplicationStatus,
  type InterviewerView,
  type Recommendation,
  type ScorecardRow,
} from './schema'
import { fieldsOf, stagesOf } from './utils/records'

// Interviews answer "not found" rather than "forbidden", so a guessed id reveals nothing.
const NOT_FOUND = 'That interview is not one of yours.'

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

function recommendationOf(value: string): Recommendation {
  return (RECOMMENDATIONS as readonly string[]).includes(value) ? (value as Recommendation) : 'no'
}

async function interviewFor(caller: MemberCaller, interviewId: string) {
  const row = await db.interview.findFirst({
    where: { id: interviewId, organizationId: caller.organizationId },
    include: {
      ...INTERVIEW_INCLUDE,
      application: {
        include: {
          posting: {
            select: { title: true, stages: true, scorecardForm: { select: { fields: true } } },
          },
          attachments: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  const canScore = Boolean(row?.interviewerIds.includes(caller.userId))
  if (!row || (!canScore && !caller.canHire)) throw new ConnectError(NOT_FOUND, Code.NotFound)
  return { row, canScore }
}

export async function loadInterviewerView(interviewId: string): Promise<InterviewerView> {
  const caller = await requireMemberCaller()
  const { row, canScore } = await interviewFor(caller, interviewId)
  const application = row.application

  const [people, mine, settings] = await Promise.all([
    interviewersById(row.interviewerIds),
    db.interviewFeedback.findUnique({
      where: { interviewId_interviewerId: { interviewId: row.id, interviewerId: caller.userId } },
    }),
    db.hiringSettings.findUnique({
      where: { organizationId: caller.organizationId },
      select: { timeZone: true },
    }),
  ])
  const stage = stagesOf(application.posting.stages).find((one) => one.id === application.stageId)

  return {
    interview: interviewRowOf(row, people),
    applicant: {
      id: application.id,
      postingId: application.postingId,
      postingTitle: application.posting.title,
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      status: application.status as ApplicationStatus,
      stageId: application.stageId,
      stageName: stage?.name ?? 'Removed stage',
      stageChangedAt: application.stageChangedAt.toISOString(),
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      hasResume: application.attachments.some((file) => file.fieldId === RESUME_FIELD_ID),
    },
    applicationFields: fieldsOf(application.fields),
    applicationValues: valuesOf(application.values),
    files: application.attachments.map((file) => ({
      id: file.id,
      fieldId: file.fieldId,
      fileName: file.fileName,
      contentType: file.contentType,
      fileSize: file.fileSize,
    })),
    scorecardFields: application.posting.scorecardForm
      ? fieldsOf(application.posting.scorecardForm.fields)
      : [],
    mine: mine
      ? {
          interviewId: mine.interviewId,
          interviewerId: mine.interviewerId,
          interviewerName: caller.name,
          recommendation: recommendationOf(mine.recommendation),
          fields: fieldsOf(mine.fields),
          values: valuesOf(mine.values),
          updatedAt: mine.updatedAt.toISOString(),
        }
      : undefined,
    timeZone: settings?.timeZone ?? DEFAULT_TIME_ZONE,
    canScore,
  }
}

export async function submitScorecard(input: {
  interviewId: string
  recommendation: string
  values: RequestValues
}): Promise<ScorecardRow> {
  const caller = await requireMemberCaller()
  const { row, canScore } = await interviewFor(caller, input.interviewId)
  if (!canScore) {
    throw new ConnectError('Only the people on this interview can score it.', Code.PermissionDenied)
  }
  if (row.status !== 'booked') {
    throw new ConnectError('Only a booked interview can be scored.', Code.FailedPrecondition)
  }
  if (!(RECOMMENDATIONS as readonly string[]).includes(input.recommendation)) {
    throw new ConnectError('Give your overall recommendation.', Code.InvalidArgument)
  }

  // Scored against the posting's questions as they stand now, and kept as they were answered.
  const fields = row.application.posting.scorecardForm
    ? fieldsOf(row.application.posting.scorecardForm.fields)
    : []
  const answers = answerSchemaOf(fields).safeParse(input.values)
  if (!answers.success) {
    throw new ConnectError(
      answers.error.issues[0]?.message ?? 'Some answers are not valid.',
      Code.InvalidArgument,
    )
  }
  const values = pruneAnswers(fields, answers.data as RequestValues)

  const existing = await db.interviewFeedback.findUnique({
    where: { interviewId_interviewerId: { interviewId: row.id, interviewerId: caller.userId } },
    select: { id: true },
  })
  const saved = await db.interviewFeedback.upsert({
    where: { interviewId_interviewerId: { interviewId: row.id, interviewerId: caller.userId } },
    create: {
      interviewId: row.id,
      interviewerId: caller.userId,
      recommendation: input.recommendation,
      fields,
      values,
    },
    update: { recommendation: input.recommendation, fields, values },
  })
  if (!existing) {
    await db.applicationEvent.create({
      data: {
        applicationId: row.applicationId,
        actorId: caller.userId,
        kind: 'scorecard_submitted',
        detail: { interviewId: row.id, recommendation: input.recommendation },
      },
    })
  }

  return {
    interviewId: saved.interviewId,
    interviewerId: saved.interviewerId,
    interviewerName: caller.name,
    recommendation: recommendationOf(saved.recommendation),
    fields,
    values,
    updatedAt: saved.updatedAt.toISOString(),
  }
}

/** Every scorecard on an application, for HR deciding it. */
export async function scorecardsOf(applicationId: string): Promise<ScorecardRow[]> {
  const rows = await db.interviewFeedback.findMany({
    where: { interview: { applicationId } },
    orderBy: { createdAt: 'asc' },
  })
  const people = await interviewersById(rows.map((row) => row.interviewerId))
  return rows.map((row) => ({
    interviewId: row.interviewId,
    interviewerId: row.interviewerId,
    interviewerName: people.get(row.interviewerId)?.name ?? 'Removed account',
    recommendation: recommendationOf(row.recommendation),
    fields: fieldsOf(row.fields),
    values: valuesOf(row.values),
    updatedAt: row.updatedAt.toISOString(),
  }))
}

/** An interviewer may open the files of someone they interview, and no one else's. */
export async function interviewsApplicant(userId: string, applicationId: string) {
  const interview = await db.interview.findFirst({
    where: { applicationId, interviewerIds: { has: userId } },
    select: { id: true },
  })
  return Boolean(interview)
}
