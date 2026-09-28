import { db } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { requireHiringCaller } from './access'
import { notifyInterviewCancelled, notifyInterviewOffered } from './interview-notifications'
import { loadInterviewContext } from './interviews'
import { loadApplication } from './pipeline-service'
import {
  offerInterviewRequestSchema,
  type ApplicationDetail,
  type Interviewer,
  type OfferInterviewRequest,
} from './schema'

export async function listInterviewers(): Promise<Interviewer[]> {
  const caller = await requireHiringCaller()
  const members = await db.member.findMany({
    where: { organizationId: caller.organizationId, user: { banned: { not: true } } },
    select: { user: { select: { id: true, name: true, preferredName: true, email: true } } },
  })
  return members
    .map(({ user }) => ({
      userId: user.id,
      name: user.preferredName ?? user.name,
      email: user.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const OPEN_STATUSES = ['offered', 'reschedule_requested']

/**
 * HR offers times; the applicant picks. A fresh offer replaces one still waiting on them, so
 * "offer new times" is just offering again, while a booked round stays as it is.
 */
export async function offerInterview(input: OfferInterviewRequest): Promise<ApplicationDetail> {
  const caller = await requireHiringCaller()
  const parsed = offerInterviewRequestSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError(
      parsed.error.issues[0]?.message ?? 'Check the interview and try again.',
      Code.InvalidArgument,
    )
  }
  const values = parsed.data

  const application = await db.jobApplication.findFirst({
    where: { id: values.applicationId, organizationId: caller.organizationId },
    select: { id: true, status: true },
  })
  if (!application) throw new ConnectError('That application no longer exists.', Code.NotFound)
  if (application.status !== 'active') {
    throw new ConnectError(
      'This application has been decided, so there is nobody to interview.',
      Code.FailedPrecondition,
    )
  }

  const now = Date.now()
  const slots = values.starts.map((iso) => {
    const start = new Date(iso)
    if (start.getTime() <= now) {
      throw new ConnectError('Every time offered has to be in the future.', Code.InvalidArgument)
    }
    return { start, end: new Date(start.getTime() + values.durationMinutes * 60_000) }
  })
  if (new Set(slots.map((slot) => slot.start.getTime())).size !== slots.length) {
    throw new ConnectError('The same time is offered twice.', Code.InvalidArgument)
  }

  const interviewerIds = [...new Set(values.interviewerIds)]
  const known = await db.member.count({
    where: { organizationId: caller.organizationId, userId: { in: interviewerIds } },
  })
  if (known !== interviewerIds.length) {
    throw new ConnectError('One of the interviewers is not in this organization.', Code.NotFound)
  }

  const created = await db.$transaction(async (tx) => {
    await tx.interview.updateMany({
      where: { applicationId: application.id, status: { in: OPEN_STATUSES } },
      data: { status: 'cancelled' },
    })
    const interview = await tx.interview.create({
      data: {
        organizationId: caller.organizationId,
        applicationId: application.id,
        createdById: caller.userId,
        format: values.format,
        location: values.location,
        note: values.note,
        durationMinutes: values.durationMinutes,
        interviewerIds,
        slots: { create: slots.sort((a, b) => a.start.getTime() - b.start.getTime()) },
      },
    })
    await tx.applicationEvent.create({
      data: {
        applicationId: application.id,
        actorId: caller.userId,
        kind: 'interview_offered',
        detail: { interviewId: interview.id, slots: slots.length },
      },
    })
    return interview
  })

  const loaded = await loadInterviewContext(created.id)
  if (loaded) notifyInterviewOffered(loaded.context)

  return loadApplication(application.id)
}

export async function cancelInterview(interviewId: string): Promise<ApplicationDetail> {
  const caller = await requireHiringCaller()
  const loaded = await loadInterviewContext(interviewId)
  if (!loaded || loaded.row.organizationId !== caller.organizationId) {
    throw new ConnectError('That interview no longer exists.', Code.NotFound)
  }
  const { row } = loaded
  if (row.status === 'cancelled') {
    throw new ConnectError('That interview was already cancelled.', Code.FailedPrecondition)
  }

  const sequence = row.sequence + 1
  await db.$transaction([
    db.interview.update({ where: { id: row.id }, data: { status: 'cancelled', sequence } }),
    db.applicationEvent.create({
      data: {
        applicationId: row.applicationId,
        actorId: caller.userId,
        kind: 'interview_cancelled',
        detail: { interviewId: row.id, wasBooked: row.status === 'booked' },
      },
    }),
  ])

  // Only a booked interview sits in anyone's calendar, so only that one needs taking back out.
  if (row.status === 'booked' && row.bookedStart && row.bookedEnd) {
    notifyInterviewCancelled(
      { ...loaded.context, sequence },
      {
        start: row.bookedStart,
        end: row.bookedEnd,
        applicantTimeZone: row.applicantTimeZone ?? loaded.context.timeZone,
      },
      { attachInvite: !row.calendarEventId },
    )
  }

  return loadApplication(row.applicationId)
}
