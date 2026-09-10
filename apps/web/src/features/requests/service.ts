import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { z } from 'zod'
import { canManageOrganization, getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { pageInfoOf, skipTake } from '@/lib/pagination'
import {
  answerSchemaOf,
  decisionSchema,
  formDraftSchema,
  formFieldSchema,
  publishBlockers,
  type DecisionValues,
  type DepartmentApproversRow,
  type FieldValue,
  type FormDraftValues,
  type FormField,
  type FormRow,
  type FormStatus,
  type RequestQuery,
  type RequestRow,
  type RequestStatus,
  type RequestValues,
  type RequestsPage,
  type SetApproverValues,
} from './schema'

// Deliberately not requireOnboarded(): that redirects, and a redirect thrown inside an RPC
// surfaces as an opaque 500 rather than a code the caller can act on.
async function requireRequester() {
  const session = await getSession()
  if (!session) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const profile = await readProfile(session.user.id)
  if (!profile) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const membership = membershipOf(profile)
  if (!membership.organizationId) {
    throw new ConnectError('Finish setting up your profile first.', Code.FailedPrecondition)
  }

  const approverTeamIds = await db.requestApprover
    .findMany({ where: { userId: session.user.id }, select: { teamId: true } })
    .then((rows) => rows.map((row) => row.teamId))

  return {
    userId: session.user.id,
    name: profile.preferredName ?? session.user.name,
    organizationId: membership.organizationId,
    team: membership.team,
    isAdmin: canManageOrganization(membership),
    approverTeamIds,
  }
}

type Caller = Awaited<ReturnType<typeof requireRequester>>

async function requireAdmin() {
  const caller = await requireRequester()
  if (!caller.isAdmin) {
    throw new ConnectError('Only an admin can manage request forms.', Code.PermissionDenied)
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

type FormRecord = Prisma.RequestFormGetPayload<{
  include: { teams: true; _count: { select: { submissions: true } } }
}>

async function toFormRow(form: FormRecord, teamNames: Map<string, string>): Promise<FormRow> {
  return {
    id: form.id,
    name: form.name,
    description: form.description ?? '',
    status: form.status as FormStatus,
    fields: fieldsOf(form.fields),
    teams: form.teams.map((link) => ({
      id: link.teamId,
      name: teamNames.get(link.teamId) ?? 'Removed department',
    })),
    submissionCount: form._count.submissions,
    updatedAt: form.updatedAt.toISOString(),
  }
}

async function teamNameMap(organizationId: string) {
  const teams = await db.team.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  })
  return new Map(teams.map((team) => [team.id, team.name]))
}

const FORM_INCLUDE = {
  teams: true,
  _count: { select: { submissions: true } },
} satisfies Prisma.RequestFormInclude

export async function loadForms(): Promise<FormRow[]> {
  const caller = await requireAdmin()
  const [forms, names] = await Promise.all([
    db.requestForm.findMany({
      where: { organizationId: caller.organizationId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: FORM_INCLUDE,
    }),
    teamNameMap(caller.organizationId),
  ])
  return Promise.all(forms.map((form) => toFormRow(form, names)))
}

export async function loadForm(formId: string): Promise<FormRow> {
  const caller = await requireAdmin()
  const form = await db.requestForm.findFirst({
    where: { id: formId, organizationId: caller.organizationId },
    include: FORM_INCLUDE,
  })
  if (!form) throw new ConnectError('That form no longer exists.', Code.NotFound)
  return toFormRow(form, await teamNameMap(caller.organizationId))
}

export async function saveForm(input: FormDraftValues): Promise<FormRow> {
  const caller = await requireAdmin()
  const parsed = formDraftSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError('Check the highlighted fields and try again.', Code.InvalidArgument)
  }
  const draft = parsed.data

  const teamIds = await validTeamIds(caller.organizationId, draft.teamIds)

  const form = await db.$transaction(async (tx) => {
    const saved = draft.formId
      ? await tx.requestForm.update({
          where: { id: draft.formId },
          data: { name: draft.name, description: draft.description, fields: draft.fields },
        })
      : await tx.requestForm.create({
          data: {
            organizationId: caller.organizationId,
            createdById: caller.userId,
            name: draft.name,
            description: draft.description,
            fields: draft.fields,
          },
        })

    // Replace rather than diff: the picker always sends the whole set.
    await tx.requestFormTeam.deleteMany({ where: { formId: saved.id } })
    if (teamIds.length > 0) {
      await tx.requestFormTeam.createMany({
        data: teamIds.map((teamId) => ({ formId: saved.id, teamId })),
      })
    }

    return tx.requestForm.findUniqueOrThrow({ where: { id: saved.id }, include: FORM_INCLUDE })
  })

  return toFormRow(form, await teamNameMap(caller.organizationId))
}

async function validTeamIds(organizationId: string, teamIds: readonly string[]) {
  if (teamIds.length === 0) return []
  const teams = await db.team.findMany({
    where: { organizationId, id: { in: [...teamIds] } },
    select: { id: true },
  })
  return teams.map((team) => team.id)
}

export async function setFormStatus(input: {
  formId: string
  status: FormStatus
}): Promise<FormRow> {
  const caller = await requireAdmin()
  const form = await db.requestForm.findFirst({
    where: { id: input.formId, organizationId: caller.organizationId },
    include: FORM_INCLUDE,
  })
  if (!form) throw new ConnectError('That form no longer exists.', Code.NotFound)

  if (input.status === 'published') {
    const names = await teamNameMap(caller.organizationId)
    const blockers = publishBlockers(await toFormRow(form, names))
    if (blockers.length > 0) throw new ConnectError(blockers.join(' '), Code.FailedPrecondition)
  }

  const updated = await db.requestForm.update({
    where: { id: form.id },
    data: { status: input.status },
    include: FORM_INCLUDE,
  })
  return toFormRow(updated, await teamNameMap(caller.organizationId))
}

export async function deleteForm(formId: string): Promise<void> {
  const caller = await requireAdmin()
  const form = await db.requestForm.findFirst({
    where: { id: formId, organizationId: caller.organizationId },
    include: { _count: { select: { submissions: true } } },
  })
  if (!form) throw new ConnectError('That form no longer exists.', Code.NotFound)

  // The requests raised against it stay readable, so a used form is archived, never deleted.
  if (form._count.submissions > 0) {
    throw new ConnectError(
      'Requests have been raised on this form, so it can only be archived.',
      Code.FailedPrecondition,
    )
  }

  await db.requestForm.delete({ where: { id: form.id } })
}

export async function loadAvailableForms(): Promise<FormRow[]> {
  const caller = await requireRequester()
  if (!caller.team) return []

  const [forms, names] = await Promise.all([
    db.requestForm.findMany({
      where: {
        organizationId: caller.organizationId,
        status: 'published',
        teams: { some: { teamId: caller.team.id } },
      },
      orderBy: { name: 'asc' },
      include: FORM_INCLUDE,
    }),
    teamNameMap(caller.organizationId),
  ])

  return Promise.all(forms.map((form) => toFormRow(form, names)))
}

export async function submitRequest(input: {
  formId: string
  values: RequestValues
}): Promise<RequestRow> {
  const caller = await requireRequester()
  if (!caller.team) {
    throw new ConnectError(
      'You need a department before you can raise a request.',
      Code.FailedPrecondition,
    )
  }

  const form = await db.requestForm.findFirst({
    where: {
      id: input.formId,
      organizationId: caller.organizationId,
      status: 'published',
      teams: { some: { teamId: caller.team.id } },
    },
  })
  if (!form) {
    throw new ConnectError('That form is not open to your department.', Code.PermissionDenied)
  }

  const fields = fieldsOf(form.fields)
  // The server is the trust boundary; the client's copy of this schema is for UX only.
  const answers = answerSchemaOf(fields).safeParse(input.values)
  if (!answers.success) {
    const first = answers.error.issues[0]
    throw new ConnectError(first?.message ?? 'Some answers are not valid.', Code.InvalidArgument)
  }

  const submission = await db.requestSubmission.create({
    data: {
      organizationId: caller.organizationId,
      formId: form.id,
      formName: form.name,
      fields,
      values: pruneAnswers(fields, answers.data as RequestValues),
      requesterId: caller.userId,
      teamId: caller.team.id,
      teamName: caller.team.name,
    },
  })

  return toRequestRow(submission, caller.name, caller)
}

// An untouched optional field is absent rather than an empty string in the record.
function pruneAnswers(fields: readonly FormField[], answers: RequestValues): RequestValues {
  const kept: RequestValues = {}
  for (const field of fields) {
    const value = answers[field.id]
    if (value === undefined || value === '') continue
    if (field.type === 'checkbox' && value === false && !field.required) continue
    kept[field.id] = value as FieldValue
  }
  return kept
}

type SubmissionRecord = Prisma.RequestSubmissionGetPayload<object>

function toRequestRow(
  submission: SubmissionRecord,
  requesterName: string,
  caller: Caller,
): RequestRow {
  return {
    id: submission.id,
    formId: submission.formId,
    formName: submission.formName,
    fields: fieldsOf(submission.fields),
    values: valuesOf(submission.values),
    requesterId: submission.requesterId,
    requesterName,
    teamName: submission.teamName ?? undefined,
    status: submission.status as RequestStatus,
    decidedBy: undefined,
    decidedAt: submission.decidedAt?.toISOString(),
    decisionNote: submission.decisionNote ?? undefined,
    createdAt: submission.createdAt.toISOString(),
    canDecide: canDecide(submission, caller),
    isMine: submission.requesterId === caller.userId,
  }
}

// An admin sees every department; an approver only the ones they were appointed to. Nobody
// decides their own request, whatever their role.
function canDecide(submission: SubmissionRecord, caller: Caller) {
  if (submission.status !== 'pending') return false
  if (submission.requesterId === caller.userId) return false
  if (caller.isAdmin) return true
  return Boolean(submission.teamId && caller.approverTeamIds.includes(submission.teamId))
}

export async function loadMyRequests(status: RequestQuery['status']): Promise<RequestRow[]> {
  const caller = await requireRequester()

  const submissions = await db.requestSubmission.findMany({
    where: {
      requesterId: caller.userId,
      ...(status === 'all' ? {} : { status }),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const names = await requesterNames(submissions)
  return submissions.map((submission) =>
    withDecider(
      toRequestRow(submission, names.get(submission.requesterId) ?? 'Unknown', caller),
      names,
      submission,
    ),
  )
}

export async function withdrawRequest(submissionId: string): Promise<RequestRow> {
  const caller = await requireRequester()
  const submission = await db.requestSubmission.findFirst({
    where: { id: submissionId, requesterId: caller.userId },
  })
  if (!submission) throw new ConnectError('That request no longer exists.', Code.NotFound)
  if (submission.status !== 'pending') {
    throw new ConnectError('Only a pending request can be withdrawn.', Code.FailedPrecondition)
  }

  const updated = await db.requestSubmission.update({
    where: { id: submission.id },
    data: { status: 'withdrawn' },
  })
  return toRequestRow(updated, caller.name, caller)
}

// Approvers see their departments' queues, admins see the whole organization, and anyone else
// gets an empty page rather than an error — the nav simply does not offer them the screen.
function queueFilter(caller: Caller): Prisma.RequestSubmissionWhereInput | undefined {
  if (caller.isAdmin) return { organizationId: caller.organizationId }
  if (caller.approverTeamIds.length === 0) return undefined
  return { organizationId: caller.organizationId, teamId: { in: caller.approverTeamIds } }
}

export async function loadRequestsPage(query: RequestQuery): Promise<RequestsPage> {
  const caller = await requireRequester()
  const scope = queueFilter(caller)

  if (!scope) {
    return {
      rows: [],
      pageInfo: pageInfoOf({ page: 1, pageSize: query.pageSize, total: 0 }),
    }
  }

  const where: Prisma.RequestSubmissionWhereInput = {
    ...scope,
    ...(query.status === 'all' ? {} : { status: query.status }),
    ...(query.teamIds.length > 0 ? { teamId: { in: query.teamIds } } : {}),
    ...(query.search
      ? {
          OR: [
            { formName: { contains: query.search, mode: 'insensitive' } },
            { teamName: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const total = await db.requestSubmission.count({ where })
  const pageInfo = pageInfoOf({ page: query.page, pageSize: query.pageSize, total })

  const submissions = await db.requestSubmission.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    ...skipTake(pageInfo),
  })

  const names = await requesterNames(submissions)

  return {
    rows: submissions.map((submission) =>
      withDecider(
        toRequestRow(submission, names.get(submission.requesterId) ?? 'Unknown', caller),
        names,
        submission,
      ),
    ),
    pageInfo,
  }
}

export async function loadRequest(submissionId: string): Promise<RequestRow> {
  const caller = await requireRequester()
  const submission = await db.requestSubmission.findFirst({
    where: { id: submissionId, organizationId: caller.organizationId },
  })
  if (!submission) throw new ConnectError('That request no longer exists.', Code.NotFound)

  const visible =
    submission.requesterId === caller.userId ||
    caller.isAdmin ||
    (submission.teamId !== null && caller.approverTeamIds.includes(submission.teamId))
  if (!visible) throw new ConnectError('That request is not yours to read.', Code.PermissionDenied)

  const names = await requesterNames([submission])
  return withDecider(
    toRequestRow(submission, names.get(submission.requesterId) ?? 'Unknown', caller),
    names,
    submission,
  )
}

export async function decideRequest(input: DecisionValues): Promise<RequestRow> {
  const caller = await requireRequester()
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) throw new ConnectError('That decision is not valid.', Code.InvalidArgument)

  const submission = await db.requestSubmission.findFirst({
    where: { id: parsed.data.submissionId, organizationId: caller.organizationId },
  })
  if (!submission) throw new ConnectError('That request no longer exists.', Code.NotFound)

  if (!canDecide(submission, caller)) {
    throw new ConnectError(
      submission.status === 'pending'
        ? 'You cannot decide this request.'
        : 'This request has already been decided.',
      submission.status === 'pending' ? Code.PermissionDenied : Code.FailedPrecondition,
    )
  }

  const updated = await db.requestSubmission.update({
    where: { id: submission.id },
    data: {
      status: parsed.data.decision,
      decidedById: caller.userId,
      decidedAt: new Date(),
      decisionNote: parsed.data.note || null,
    },
  })

  const names = await requesterNames([updated])
  return withDecider(
    toRequestRow(updated, names.get(updated.requesterId) ?? 'Unknown', caller),
    names,
    updated,
  )
}

// Requester and decider names come from one lookup rather than a join, because the user table
// lives in another Postgres schema with no relation to these rows.
async function requesterNames(submissions: readonly SubmissionRecord[]) {
  const ids = new Set<string>()
  for (const submission of submissions) {
    ids.add(submission.requesterId)
    if (submission.decidedById) ids.add(submission.decidedById)
  }
  if (ids.size === 0) return new Map<string, string>()

  const users = await db.user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true, preferredName: true },
  })
  return new Map(users.map((user) => [user.id, user.preferredName ?? user.name]))
}

function withDecider(
  row: RequestRow,
  names: Map<string, string>,
  submission: SubmissionRecord,
): RequestRow {
  return {
    ...row,
    decidedBy: submission.decidedById
      ? (names.get(submission.decidedById) ?? 'Unknown')
      : undefined,
  }
}

export async function loadApprovers(): Promise<DepartmentApproversRow[]> {
  const caller = await requireAdmin()

  const [teams, approvers] = await Promise.all([
    db.team.findMany({
      where: { organizationId: caller.organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.requestApprover.findMany({ where: { organizationId: caller.organizationId } }),
  ])

  const users = await db.user.findMany({
    where: { id: { in: approvers.map((row) => row.userId) } },
    select: { id: true, name: true, preferredName: true, email: true },
  })
  const byId = new Map(users.map((user) => [user.id, user]))

  return teams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    approvers: approvers
      .filter((row) => row.teamId === team.id)
      .map((row) => {
        const user = byId.get(row.userId)
        return {
          userId: row.userId,
          name: user ? (user.preferredName ?? user.name) : 'Removed account',
          email: user?.email ?? '',
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name)),
  }))
}

export async function setApprover(input: SetApproverValues): Promise<DepartmentApproversRow> {
  const caller = await requireAdmin()

  const team = await db.team.findFirst({
    where: { id: input.teamId, organizationId: caller.organizationId },
    select: { id: true, name: true },
  })
  if (!team) throw new ConnectError('That department no longer exists.', Code.NotFound)

  if (input.approver) {
    const inOrganization = await db.member.findFirst({
      where: { organizationId: caller.organizationId, userId: input.userId },
      select: { id: true },
    })
    if (!inOrganization) {
      throw new ConnectError('That person is not in this organization.', Code.InvalidArgument)
    }

    await db.requestApprover.upsert({
      where: { teamId_userId: { teamId: team.id, userId: input.userId } },
      update: {},
      create: {
        organizationId: caller.organizationId,
        teamId: team.id,
        userId: input.userId,
      },
    })
  } else {
    await db.requestApprover.deleteMany({ where: { teamId: team.id, userId: input.userId } })
  }

  const departments = await loadApprovers()
  const department = departments.find((row) => row.teamId === team.id)
  if (!department) throw new ConnectError('That department no longer exists.', Code.NotFound)
  return department
}
