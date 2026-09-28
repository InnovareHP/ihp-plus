import { db } from '../src/client'
import type { Prisma } from '../src/generated/prisma/client'
import {
  HIRING_FORM_SEED,
  HIRING_POSTING_SEED,
  HIRING_SETTINGS_SEED,
  type SeedApplicant,
  type SeedInterview,
  type SeedPosting,
  type SeedStage,
} from './hiring-seed-data'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
// Marks demo applicants, so --wipe can take them without touching real ones.
const SEED_SOURCE = 'seed'
// Stages an interview is held in; the latest one wins when an applicant has passed several.
const INTERVIEW_STAGES = new Set(['interview', 'technical', 'panel'])

// Seed rows are plain JSON-safe objects; interfaces just lack the index signature Prisma wants.
function json(value: unknown) {
  return value as Prisma.InputJsonValue
}

/** Milliseconds a zone is ahead of UTC at that instant, read through Intl so DST is right. */
function zoneOffset(at: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(at))
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0)
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  )
  return asUtc - Math.floor(at / 1000) * 1000
}

/** The instant it is `hour`:00 in `timeZone`, `days` days from today there. */
function zonedTime(days: number, hour: number, timeZone: string, now: number) {
  const local = new Date(now + zoneOffset(now, timeZone))
  const guess = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + days,
    hour,
  )
  return new Date(guess - zoneOffset(guess, timeZone))
}

interface Staff {
  userIds: string[]
  at: (index: number) => string | undefined
}

async function staffOf(organizationId: string): Promise<Staff> {
  const members = await db.member.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  })
  const userIds = members.map((member) => member.userId)
  return { userIds, at: (index) => userIds[index] ?? userIds[0] }
}

/** Settings are configuration an admin owns, so they are only written when none exist yet. */
async function seedSettings(organizationId: string) {
  const existing = await db.hiringSettings.findUnique({ where: { organizationId } })
  if (existing) return

  const hrTeam = await db.team.findFirst({
    where: { organizationId, name: HIRING_SETTINGS_SEED.hrDepartment },
    select: { id: true },
  })
  await db.hiringSettings.create({
    data: {
      organizationId,
      hrTeamId: hrTeam?.id ?? null,
      defaultStages: json(HIRING_SETTINGS_SEED.defaultStages),
      rejectionMessage: HIRING_SETTINGS_SEED.rejectionMessage,
      timeZone: HIRING_SETTINGS_SEED.timeZone,
    },
  })
  console.log(
    `  + hiring settings${hrTeam ? ` (${HIRING_SETTINGS_SEED.hrDepartment} runs hiring)` : ''}`,
  )
}

async function seedForms(organizationId: string) {
  const present = await db.requestForm.findMany({
    where: { organizationId, kind: { in: ['application', 'scorecard'] } },
    select: { id: true, name: true, fields: true },
  })
  const forms = new Map(present.map((form) => [form.name, form]))

  for (const form of HIRING_FORM_SEED) {
    if (forms.has(form.name)) continue
    const created = await db.requestForm.create({
      data: {
        organizationId,
        kind: form.kind,
        name: form.name,
        description: form.description,
        status: 'published',
        fields: json(form.fields),
      },
      select: { id: true, name: true, fields: true },
    })
    forms.set(created.name, created)
    console.log(`  + ${form.kind} form ${form.name}`)
  }
  return forms
}

interface Timeline {
  appliedAt: Date
  moves: { stage: SeedStage; from: SeedStage; at: Date }[]
  interviewAt: Date | undefined
  decidedAt: Date
}

/**
 * Spreads an applicant's stage moves evenly between applying and now, then bends them around
 * the interview so it is offered after they reach its stage and later moves follow it.
 */
function timelineOf(
  posting: SeedPosting,
  person: SeedApplicant,
  slotStart: Date | undefined,
  slotEnd: Date | undefined,
  now: number,
): Timeline {
  const stageIndex = Math.max(
    0,
    posting.stages.findIndex((stage) => stage.id === person.stageId),
  )
  const path = posting.stages.slice(1, stageIndex + 1)
  const closedAt =
    posting.status === 'archived' && posting.closesInDays !== null
      ? now + posting.closesInDays * DAY
      : now
  const horizon = (person.status === 'active' ? now : closedAt) - 2 * HOUR
  let applied = Math.min(now - person.appliedDaysAgo * DAY - 3 * HOUR, horizon - HOUR)

  const step = (horizon - applied) / (path.length + 1)
  const times = path.map((_, index) => applied + step * (index + 1))

  const interviewIndex = path.map((stage) => INTERVIEW_STAGES.has(stage.id)).lastIndexOf(true)
  if (slotStart && slotEnd && interviewIndex >= 0) {
    times[interviewIndex] = Math.min(times[interviewIndex] ?? now, slotStart.getTime() - 2 * DAY)
    for (let index = interviewIndex + 1; index < times.length; index += 1) {
      const current = times[index] ?? now
      if (slotEnd.getTime() < now) {
        times[index] = Math.min(Math.max(current, slotEnd.getTime() + DAY), now - HOUR)
      }
    }
    for (let index = interviewIndex - 1; index >= 0; index -= 1) {
      times[index] = Math.min(times[index] ?? now, (times[index + 1] ?? now) - HOUR)
    }
  }
  applied = Math.min(applied, (times[0] ?? applied + HOUR) - HOUR)

  const last = Math.max(applied, ...times)
  return {
    appliedAt: new Date(applied),
    moves: path.map((stage, index) => ({
      stage,
      from: posting.stages[index] ?? stage,
      at: new Date(times[index] ?? now),
    })),
    interviewAt:
      interviewIndex >= 0 ? new Date((times[interviewIndex] ?? applied) + HOUR) : undefined,
    decidedAt: new Date(Math.min(last + 2 * DAY, horizon)),
  }
}

interface EventRow {
  kind: string
  actorId: string | null
  detail: Record<string, string | number | boolean>
  createdAt: Date
}

async function seedInterview(
  applicationId: string,
  organizationId: string,
  spec: SeedInterview,
  starts: Date[],
  offeredAt: Date,
  staff: Staff,
  scorecardFields: unknown,
  now: number,
  events: EventRow[],
) {
  const createdById = staff.at(spec.interviewers[0] ?? 0)
  if (!createdById) return
  const interviewerIds = [
    ...new Set(
      spec.interviewers.map((index) => staff.at(index)).filter((id): id is string => !!id),
    ),
  ]
  const duration = spec.durationMinutes * 60 * 1000
  const first = starts[0]
  if (!first) return
  const booked = spec.status === 'booked'
  const bookedEnd = new Date(first.getTime() + duration)

  const interview = await db.interview.create({
    data: {
      organizationId,
      applicationId,
      createdById,
      format: spec.format,
      location: spec.location,
      note: spec.note,
      durationMinutes: spec.durationMinutes,
      interviewerIds,
      status: spec.status,
      bookedStart: booked ? first : null,
      bookedEnd: booked ? bookedEnd : null,
      sequence: spec.status === 'offered' ? 0 : 1,
      // Stamped so the reminder cron never emails a demo applicant or interviewer.
      reminderSentAt: booked ? new Date(now) : null,
      feedbackAskedAt: booked ? new Date(now) : null,
      createdAt: offeredAt,
      slots: {
        create: starts.map((start) => ({ start, end: new Date(start.getTime() + duration) })),
      },
    },
  })

  events.push({
    kind: 'interview_offered',
    actorId: createdById,
    detail: { interviewId: interview.id, slots: starts.length },
    createdAt: offeredAt,
  })
  const answeredAt = new Date(Math.min(offeredAt.getTime() + 20 * HOUR, now - HOUR))
  if (booked) {
    events.push({
      kind: 'interview_booked',
      actorId: null,
      detail: { interviewId: interview.id, start: first.toISOString() },
      createdAt: answeredAt,
    })
  }
  if (spec.status === 'reschedule_requested') {
    events.push({
      kind: 'interview_reschedule_requested',
      actorId: null,
      detail: { interviewId: interview.id },
      createdAt: answeredAt,
    })
  }
  if (spec.status === 'cancelled') {
    events.push({
      kind: 'interview_cancelled',
      actorId: createdById,
      detail: { interviewId: interview.id, wasBooked: false },
      createdAt: answeredAt,
    })
  }

  if (!booked || bookedEnd.getTime() > now) return
  for (const [order, feedback] of (spec.feedback ?? []).entries()) {
    const interviewerId = staff.userIds[feedback.interviewer]
    if (!interviewerId) continue
    const submittedAt = new Date(Math.min(bookedEnd.getTime() + (3 + order) * HOUR, now - HOUR))
    await db.interviewFeedback.create({
      data: {
        interviewId: interview.id,
        interviewerId,
        recommendation: feedback.recommendation,
        fields: json(scorecardFields ?? []),
        values: feedback.values,
        createdAt: submittedAt,
      },
    })
    events.push({
      kind: 'scorecard_submitted',
      actorId: interviewerId,
      detail: { interviewId: interview.id, recommendation: feedback.recommendation },
      createdAt: submittedAt,
    })
  }
}

async function seedApplicant(
  posting: SeedPosting,
  row: { id: string; organizationId: string },
  person: SeedApplicant,
  applicationFields: unknown,
  scorecardFields: unknown,
  staff: Staff,
  now: number,
) {
  const spec = person.interview
  const starts = spec
    ? Array.from({ length: spec.slots }, (_, index) =>
        zonedTime(spec.day + index, spec.hour, posting.timeZone, now),
      )
    : []
  const slotEnd =
    spec && starts[0] ? new Date(starts[0].getTime() + spec.durationMinutes * 60_000) : undefined
  const timeline = timelineOf(posting, person, starts[0], slotEnd, now)
  const actor = staff.at(0) ?? null
  const decided = person.status === 'hired' || person.status === 'rejected'
  const lastMove = timeline.moves.at(-1)?.at ?? timeline.appliedAt

  const application = await db.jobApplication.create({
    data: {
      organizationId: row.organizationId,
      postingId: row.id,
      fullName: person.fullName,
      email: person.email,
      phone: person.phone,
      postingTitle: posting.title,
      fields: json(applicationFields ?? []),
      values: person.answers,
      status: person.status,
      stageId: person.stageId,
      stageChangedAt: lastMove,
      rejectionReason: person.rejectionReason ?? null,
      decidedById: decided ? actor : null,
      decidedAt: person.status === 'active' ? null : timeline.decidedAt,
      consentAt: timeline.appliedAt,
      source: SEED_SOURCE,
      createdAt: timeline.appliedAt,
    },
  })

  const events: EventRow[] = [
    {
      kind: 'applied',
      actorId: null,
      detail: { stageId: posting.stages[0]?.id ?? 'applied' },
      createdAt: timeline.appliedAt,
    },
    ...timeline.moves.map((move) => ({
      kind: 'moved',
      actorId: actor,
      detail: {
        fromStageId: move.from.id,
        toStageId: move.stage.id,
        toStageName: move.stage.name,
        emailed: move.stage.message.length > 0,
      },
      createdAt: move.at,
    })),
  ]

  if (spec && staff.userIds.length > 0) {
    const offeredAt = timeline.interviewAt ?? new Date(timeline.appliedAt.getTime() + HOUR)
    await seedInterview(
      application.id,
      row.organizationId,
      spec,
      starts,
      offeredAt,
      staff,
      scorecardFields,
      now,
      events,
    )
  }

  if (person.status === 'rejected') {
    events.push({
      kind: 'rejected',
      actorId: actor,
      detail: { reason: person.rejectionReason ?? '', emailed: true },
      createdAt: timeline.decidedAt,
    })
  }
  if (person.status === 'withdrawn') {
    events.push({ kind: 'withdrawn', actorId: null, detail: {}, createdAt: timeline.decidedAt })
  }
  if (person.status === 'hired') {
    events.push({
      kind: 'hired',
      actorId: actor,
      detail: { invited: true, resent: false },
      createdAt: timeline.decidedAt,
    })
  }

  await db.applicationEvent.createMany({
    data: events.map((event) => ({ applicationId: application.id, ...event })),
  })

  const author = staff.at(1)
  if (author && person.notes) {
    await db.applicationNote.createMany({
      data: person.notes.map((note) => ({
        applicationId: application.id,
        authorId: author,
        body: note.body,
        createdAt: new Date(
          Math.max(now - note.daysAgo * DAY - HOUR, timeline.appliedAt.getTime() + HOUR),
        ),
      })),
    })
  }
}

/**
 * Postings are matched by slug, so a re-run adds only the ones missing and never duplicates
 * an applicant; --wipe first is how to refresh them.
 */
export async function seedHiring(organizationId: string) {
  await seedSettings(organizationId)
  const forms = await seedForms(organizationId)
  const staff = await staffOf(organizationId)
  if (staff.userIds.length === 0) {
    console.log('  no members yet, so notes, interviews and scorecards were skipped')
  }

  const teams = await db.team.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  })
  const teamOf = new Map(teams.map((team) => [team.name, team.id]))
  const taken = new Set(
    (
      await db.jobPosting.findMany({
        where: { organizationId, slug: { in: HIRING_POSTING_SEED.map((posting) => posting.slug) } },
        select: { slug: true },
      })
    ).map((posting) => posting.slug),
  )

  const now = Date.now()
  for (const posting of HIRING_POSTING_SEED) {
    if (taken.has(posting.slug)) continue

    const applicationForm = posting.applicationForm ? forms.get(posting.applicationForm) : undefined
    const scorecardForm = posting.scorecardForm ? forms.get(posting.scorecardForm) : undefined
    const openedAt =
      posting.openedDaysAgo === null ? null : new Date(now - posting.openedDaysAgo * DAY)

    const row = await db.jobPosting.create({
      data: {
        organizationId,
        createdById: staff.at(0) ?? null,
        teamId: teamOf.get(posting.department) ?? null,
        slug: posting.slug,
        title: posting.title,
        summary: posting.summary,
        description: posting.description,
        location: posting.location,
        workplace: posting.workplace,
        employmentType: posting.employmentType,
        salaryMin: posting.salaryMin,
        salaryMax: posting.salaryMax,
        salaryCurrency: posting.salaryCurrency,
        salaryPeriod: posting.salaryPeriod,
        status: posting.status,
        resumeRequired: posting.resumeRequired,
        stages: json(posting.stages),
        applicationFormId: applicationForm?.id ?? null,
        scorecardFormId: scorecardForm?.id ?? null,
        openedAt,
        closesAt: posting.closesInDays === null ? null : new Date(now + posting.closesInDays * DAY),
        createdAt: new Date((openedAt?.getTime() ?? now) - 2 * DAY),
      },
      select: { id: true, organizationId: true },
    })

    for (const person of posting.applicants) {
      await seedApplicant(
        posting,
        row,
        person,
        applicationForm?.fields,
        scorecardForm?.fields,
        staff,
        now,
      )
    }
    console.log(
      `  + posting ${posting.title} (${posting.status}, ${posting.applicants.length} applicants)`,
    )
  }
}

/** Only demo rows go: seeded applicants, then seeded postings and forms nothing else still uses. */
export async function wipeHiring(organizationId: string) {
  // Events, notes, interviews, slots and scorecards cascade with their application.
  const applications = await db.jobApplication.deleteMany({
    where: { organizationId, source: SEED_SOURCE },
  })
  const postings = await db.jobPosting.deleteMany({
    where: {
      organizationId,
      slug: { in: HIRING_POSTING_SEED.map((posting) => posting.slug) },
      applications: { none: {} },
    },
  })
  const forms = await db.requestForm.deleteMany({
    where: {
      organizationId,
      kind: { in: ['application', 'scorecard'] },
      name: { in: HIRING_FORM_SEED.map((form) => form.name) },
      postings: { none: {} },
      scorecards: { none: {} },
    },
  })
  console.log(
    `  - ${applications.count} demo applicants, ${postings.count} postings, ${forms.count} hiring forms`,
  )
}
