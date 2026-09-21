import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { z } from 'zod'
import { canManageOrganization, getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { pageInfoOf, skipTake } from '@/lib/pagination'
import { recordActivity } from '@/lib/activity'
import {
  answerSchemaOf,
  formFieldSchema,
  type FormField,
  type RequestValues,
} from '@/features/requests/schema'
import { notifyAssigner, notifyEvaluator, notifyEvaluatorCancelled } from './notifications'
import {
  assignEvaluationsSchema,
  type AssignEvaluationsValues,
  type EvaluationCandidate,
  type EvaluationQuery,
  type EvaluationRow,
  type EvaluationStatus,
  type EvaluationsPage,
  type MyEvaluationQuery,
} from './schema'

// Deliberately not requireOnboarded(): that redirects, and a redirect thrown inside an RPC
// surfaces as an opaque 500 rather than a code the caller can act on.
async function requireCaller() {
  const session = await getSession()
  if (!session) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const profile = await readProfile(session.user.id)
  if (!profile) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const membership = membershipOf(profile)
  if (!membership.organizationId) {
    throw new ConnectError('Finish setting up your profile first.', Code.FailedPrecondition)
  }

  return {
    userId: session.user.id,
    name: profile.preferredName ?? session.user.name,
    organizationId: membership.organizationId,
    isAdmin: canManageOrganization(membership),
  }
}

type Caller = Awaited<ReturnType<typeof requireCaller>>

async function requireAdmin() {
  const caller = await requireCaller()
  if (!caller.isAdmin) {
    throw new ConnectError('Only an admin can assign evaluations.', Code.PermissionDenied)
  }
  return caller
}

const fieldsSchema = z.array(formFieldSchema)

// Stored JSON is data the app wrote, but a hand-edited row must not crash a whole list.
function fieldsOf(value: Prisma.JsonValue): FormField[] {
  const parsed = fieldsSchema.safeParse(value)
  return parsed.success ? parsed.data : []
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

type EvaluationRecord = Prisma.EvaluationAssignmentGetPayload<object>

interface Person {
  name: string
  team: string | undefined
  employmentStatus: string | undefined
}

// The user table lives in another Postgres schema with no relation to these rows, so people
// come from one lookup rather than a join.
async function peopleOf(rows: readonly EvaluationRecord[]) {
  const ids = new Set<string>()
  for (const row of rows) {
    ids.add(row.employeeId)
    ids.add(row.evaluatorId)
  }
  if (ids.size === 0) return new Map<string, Person>()

  const users = await db.user.findMany({
    where: { id: { in: [...ids] } },
    select: {
      id: true,
      name: true,
      preferredName: true,
      employmentStatus: true,
      teammembers: { select: { team: { select: { name: true } } }, take: 1 },
    },
  })

  return new Map(
    users.map((user) => [
      user.id,
      {
        name: user.preferredName ?? user.name,
        team: user.teammembers[0]?.team.name,
        employmentStatus: user.employmentStatus ?? undefined,
      },
    ]),
  )
}

function rowOf(row: EvaluationRecord, people: Map<string, Person>, caller: Caller): EvaluationRow {
  const employee = people.get(row.employeeId)
  const status = row.status as EvaluationStatus

  return {
    id: row.id,
    formId: row.formId,
    formName: row.formName,
    fields: fieldsOf(row.fields),
    values: valuesOf(row.values),
    employeeId: row.employeeId,
    employeeName: employee?.name ?? 'Removed account',
    employeeTeam: employee?.team,
    employeeEmploymentStatus: employee?.employmentStatus,
    evaluatorId: row.evaluatorId,
    evaluatorName: people.get(row.evaluatorId)?.name ?? 'Removed account',
    status,
    dueAt: row.dueAt?.toISOString(),
    submittedAt: row.submittedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    canFill: status === 'pending' && row.evaluatorId === caller.userId,
    isMine: row.evaluatorId === caller.userId,
  }
}

async function rowsOf(rows: readonly EvaluationRecord[], caller: Caller) {
  const people = await peopleOf(rows)
  return rows.map((row) => rowOf(row, people, caller))
}

export async function loadMyEvaluationsPage(query: MyEvaluationQuery): Promise<EvaluationsPage> {
  const caller = await requireCaller()

  const where: Prisma.EvaluationAssignmentWhereInput = {
    evaluatorId: caller.userId,
    organizationId: caller.organizationId,
    ...(query.status === 'all' ? {} : { status: query.status }),
    ...(query.search
      ? {
          OR: [
            { formName: { contains: query.search, mode: 'insensitive' } },
            { employeeId: { in: await userIdsMatching(caller.organizationId, query.search) } },
          ],
        }
      : {}),
  }

  const total = await db.evaluationAssignment.count({ where })
  const pageInfo = pageInfoOf({ page: query.page, pageSize: query.pageSize, total })

  const rows = await db.evaluationAssignment.findMany({
    where,
    // The ones with a deadline come first; an evaluation with no due date never jumps the queue.
    orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    ...skipTake(pageInfo),
  })

  return { rows: await rowsOf(rows, caller), pageInfo }
}

export async function loadEvaluation(evaluationId: string): Promise<EvaluationRow> {
  const caller = await requireCaller()

  const row = await db.evaluationAssignment.findFirst({
    where: { id: evaluationId, organizationId: caller.organizationId },
  })
  if (!row) throw new ConnectError('That evaluation no longer exists.', Code.NotFound)

  // What a supervisor wrote about someone is read by the supervisor and People & Culture, not
  // by the rest of the organization.
  if (row.evaluatorId !== caller.userId && !caller.isAdmin) {
    throw new ConnectError('That evaluation is not yours to read.', Code.PermissionDenied)
  }

  const [result] = await rowsOf([row], caller)
  if (!result) throw new ConnectError('That evaluation no longer exists.', Code.NotFound)
  return result
}

export async function submitEvaluation(input: {
  evaluationId: string
  values: RequestValues
}): Promise<EvaluationRow> {
  const caller = await requireCaller()

  const row = await db.evaluationAssignment.findFirst({
    where: { id: input.evaluationId, organizationId: caller.organizationId },
  })
  if (!row) throw new ConnectError('That evaluation no longer exists.', Code.NotFound)

  if (row.evaluatorId !== caller.userId) {
    throw new ConnectError('Only the evaluator can fill this in.', Code.PermissionDenied)
  }
  if (row.status !== 'pending') {
    throw new ConnectError(
      row.status === 'submitted'
        ? 'This evaluation has already been submitted.'
        : 'This evaluation was cancelled.',
      Code.FailedPrecondition,
    )
  }

  const fields = fieldsOf(row.fields)
  // The server is the trust boundary; the client's copy of this schema is for UX only.
  const answers = answerSchemaOf(fields).safeParse(input.values)
  if (!answers.success) {
    const first = answers.error.issues[0]
    throw new ConnectError(first?.message ?? 'Some answers are not valid.', Code.InvalidArgument)
  }

  const updated = await db.evaluationAssignment.update({
    where: { id: row.id },
    data: {
      values: pruneAnswers(fields, answers.data as RequestValues),
      status: 'submitted',
      submittedAt: new Date(),
    },
  })

  // Not awaited: the answers are saved whether or not the mail provider answers promptly.
  void notifyAssigner({
    evaluationId: updated.id,
    assignedById: updated.assignedById,
    evaluatorId: updated.evaluatorId,
    evaluatorName: caller.name,
    employeeId: updated.employeeId,
    formName: updated.formName,
  })

  await recordActivity({
    organizationId: caller.organizationId,
    subjectType: 'evaluation',
    subjectId: updated.id,
    action: 'evaluation.submitted',
    actorId: caller.userId,
    actorName: caller.name,
  })

  const [result] = await rowsOf([updated], caller)
  if (!result) throw new ConnectError('That evaluation no longer exists.', Code.NotFound)
  return result
}

// An untouched optional field is absent rather than an empty string in the record.
function pruneAnswers(fields: readonly FormField[], answers: RequestValues): RequestValues {
  const kept: RequestValues = {}
  for (const field of fields) {
    const value = answers[field.id]
    if (value === undefined || value === '') continue
    if (field.type === 'checkbox' && value === false && !field.required) continue
    kept[field.id] = value
  }
  return kept
}

export async function assignEvaluations(input: AssignEvaluationsValues): Promise<EvaluationRow[]> {
  const caller = await requireAdmin()
  const parsed = assignEvaluationsSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError('Check the highlighted fields and try again.', Code.InvalidArgument)
  }
  const values = parsed.data

  const form = await db.requestForm.findFirst({
    where: {
      id: values.formId,
      organizationId: caller.organizationId,
      kind: 'evaluation',
      status: 'published',
    },
  })
  if (!form) {
    throw new ConnectError('That evaluation form is not published.', Code.FailedPrecondition)
  }

  const employeeIds = await membersAmong(caller.organizationId, values.employeeIds)
  if (employeeIds.length === 0) {
    throw new ConnectError('Nobody you picked is in this organization.', Code.InvalidArgument)
  }
  const [evaluatorId] = await membersAmong(caller.organizationId, [values.evaluatorId])
  if (!evaluatorId) {
    throw new ConnectError('That evaluator is not in this organization.', Code.InvalidArgument)
  }

  // A second copy of the same evaluation would leave the supervisor guessing which to fill in.
  const waiting = await db.evaluationAssignment.findMany({
    where: { formId: form.id, status: 'pending', employeeId: { in: employeeIds } },
    select: { employeeId: true },
  })
  const waitingIds = new Set(waiting.map((row) => row.employeeId))
  const targets = employeeIds.filter((employeeId) => !waitingIds.has(employeeId))
  if (targets.length === 0) {
    throw new ConnectError(
      'Everyone you picked already has this evaluation waiting.',
      Code.FailedPrecondition,
    )
  }

  const dueAt = values.dueAt ? new Date(`${values.dueAt}T23:59:59.999Z`) : null
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    throw new ConnectError('That due date is not a date.', Code.InvalidArgument)
  }

  const fields = fieldsOf(form.fields)
  const created = await db.$transaction(
    targets.map((employeeId) =>
      db.evaluationAssignment.create({
        data: {
          organizationId: caller.organizationId,
          employeeId,
          evaluatorId,
          assignedById: caller.userId,
          formId: form.id,
          // Snapshots: a form renamed or reordered later still renders as it was assigned.
          formName: form.name,
          fields,
          dueAt,
        },
      }),
    ),
  )

  // Not awaited: a slow mail provider must not hold up the assignment.
  void notifyEvaluator({
    evaluatorId,
    formName: form.name,
    count: created.length,
    dueAt,
  })

  for (const row of created) {
    await recordActivity({
      organizationId: caller.organizationId,
      subjectType: 'evaluation',
      subjectId: row.id,
      action: 'evaluation.assigned',
      actorId: caller.userId,
      actorName: caller.name,
    })
  }

  return rowsOf(created, caller)
}

async function membersAmong(organizationId: string, userIds: readonly string[]) {
  const members = await db.member.findMany({
    where: { organizationId, userId: { in: [...userIds] } },
    select: { userId: true },
  })
  return members.map((member) => member.userId)
}

export async function cancelEvaluation(evaluationId: string): Promise<EvaluationRow> {
  const caller = await requireAdmin()

  const row = await db.evaluationAssignment.findFirst({
    where: { id: evaluationId, organizationId: caller.organizationId },
  })
  if (!row) throw new ConnectError('That evaluation no longer exists.', Code.NotFound)
  if (row.status !== 'pending') {
    throw new ConnectError(
      'Only an evaluation nobody has filled in can be cancelled.',
      Code.FailedPrecondition,
    )
  }

  const updated = await db.evaluationAssignment.update({
    where: { id: row.id },
    data: { status: 'cancelled' },
  })

  // Not awaited: whoever was going to fill it in is told, but the cancellation already stands.
  void notifyEvaluatorCancelled({
    evaluatorId: updated.evaluatorId,
    employeeId: updated.employeeId,
    formName: updated.formName,
    cancelledByName: caller.name,
  })

  await recordActivity({
    organizationId: caller.organizationId,
    subjectType: 'evaluation',
    subjectId: updated.id,
    action: 'evaluation.cancelled',
    actorId: caller.userId,
    actorName: caller.name,
  })

  const [result] = await rowsOf([updated], caller)
  if (!result) throw new ConnectError('That evaluation no longer exists.', Code.NotFound)
  return result
}

export async function loadEvaluationsPage(query: EvaluationQuery): Promise<EvaluationsPage> {
  const caller = await requireAdmin()

  const where: Prisma.EvaluationAssignmentWhereInput = {
    organizationId: caller.organizationId,
    ...(query.status === 'all' ? {} : { status: query.status }),
    ...(query.teamIds.length > 0
      ? { employeeId: { in: await userIdsInTeams(query.teamIds) } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { formName: { contains: query.search, mode: 'insensitive' } },
            { employeeId: { in: await userIdsMatching(caller.organizationId, query.search) } },
          ],
        }
      : {}),
  }

  const total = await db.evaluationAssignment.count({ where })
  const pageInfo = pageInfoOf({ page: query.page, pageSize: query.pageSize, total })

  const rows = await db.evaluationAssignment.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    ...skipTake(pageInfo),
  })

  return { rows: await rowsOf(rows, caller), pageInfo }
}

async function userIdsInTeams(teamIds: readonly string[]) {
  const rows = await db.teamMember.findMany({
    where: { teamId: { in: [...teamIds] } },
    select: { userId: true },
  })
  return rows.map((row) => row.userId)
}

// The employee's name lives in another Postgres schema, so searching it is a second lookup.
async function userIdsMatching(organizationId: string, search: string) {
  const members = await db.member.findMany({
    where: {
      organizationId,
      user: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
    },
    select: { userId: true },
  })
  return members.map((member) => member.userId)
}

export async function loadCandidates(): Promise<EvaluationCandidate[]> {
  const caller = await requireAdmin()

  const members = await db.member.findMany({
    where: { organizationId: caller.organizationId },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          preferredName: true,
          email: true,
          employmentStatus: true,
          teammembers: { select: { team: { select: { name: true } } }, take: 1 },
        },
      },
    },
  })

  return members
    .map((member) => ({
      userId: member.user.id,
      name: member.user.preferredName ?? member.user.name,
      email: member.user.email,
      team: member.user.teammembers[0]?.team.name,
      employmentStatus: member.user.employmentStatus ?? undefined,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}
