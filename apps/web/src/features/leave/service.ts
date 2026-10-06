import { workDateKey } from '@ihp/clock'
import { db } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { settingsOf } from '@/features/attendance/service'
import { workingDaysCalendar } from '@/features/attendance/working-days'
import {
  canRead,
  requireRequester,
  valuesOf,
  type RequestCaller,
} from '@/features/requests/service'
import { TIME_OFF_FIRST_DAY, TIME_OFF_LAST_DAY, timeOffRangeOf } from '@/features/requests/time-off'
import { balanceOf, clipToYear, yearRange, type DateRange } from './balance'
import {
  setAllowanceSchema,
  type FormAllowance,
  type LeaveBalance,
  type LeavePreview,
  type LeavePreviewInput,
  type MyLeaveBalances,
  type PersonBalances,
  type SetAllowanceValues,
  type TeamLeaveBalances,
} from './schema'

interface TrackedForm {
  id: string
  name: string
  leaveAllowance: number
}

/** The year as the organization's clock reads it today. */
async function currentYear(organizationId: string) {
  const settings = await settingsOf(organizationId)
  return Number(workDateKey(new Date(), settings.timeZone).slice(0, 4))
}

async function trackedForms(organizationId: string, teamId?: string): Promise<TrackedForm[]> {
  const forms = await db.requestForm.findMany({
    where: {
      organizationId,
      kind: 'request',
      timeOff: true,
      status: 'published',
      leaveAllowance: { not: null },
      ...(teamId ? { teams: { some: { teamId } } } : {}),
    },
    select: { id: true, name: true, leaveAllowance: true },
    orderBy: { name: 'asc' },
  })
  return forms.map((form) => ({ ...form, leaveAllowance: form.leaveAllowance ?? 0 }))
}

/**
 * Used days are the leave an approval actually booked, so a cancel gives them back on its own;
 * pending days are counted from the dates asked for, on the requester's own shift.
 */
async function balancesFor(
  organizationId: string,
  userIds: readonly string[],
  forms: readonly TrackedForm[],
  year: number,
  options: { skipSubmissionId?: string } = {},
): Promise<Map<string, LeaveBalance[]>> {
  const result = new Map<string, LeaveBalance[]>()
  if (userIds.length === 0 || forms.length === 0) {
    for (const userId of userIds) result.set(userId, [])
    return result
  }

  const formIds = forms.map((form) => form.id)
  const window = yearRange(year)
  const [overrides, submissions, calendar] = await Promise.all([
    db.leaveAllowance.findMany({
      where: { formId: { in: formIds }, userId: { in: [...userIds] } },
      select: { formId: true, userId: true, days: true },
    }),
    db.requestSubmission.findMany({
      where: {
        organizationId,
        formId: { in: formIds },
        requesterId: { in: [...userIds] },
        timeOff: true,
        OR: [{ status: 'approved', cancelledAt: null }, { status: 'pending' }],
      },
      select: { id: true, formId: true, requesterId: true, status: true, values: true },
    }),
    workingDaysCalendar(organizationId, userIds, window),
  ])

  const approved = submissions.filter((row) => row.status === 'approved')
  const booked = await db.attendanceLeave.groupBy({
    by: ['submissionId'],
    where: {
      submissionId: { in: approved.map((row) => row.id) },
      date: {
        gte: new Date(`${window.from}T00:00:00.000Z`),
        lte: new Date(`${window.to}T00:00:00.000Z`),
      },
    },
    _count: { _all: true },
  })
  const bookedBy = new Map(booked.map((row) => [row.submissionId, row._count._all]))

  const tally = new Map<string, { used: number; pending: number }>()
  const keyOf = (userId: string, formId: string) => `${userId}:${formId}`
  for (const row of submissions) {
    if (row.id === options.skipSubmissionId) continue
    const entry = tally.get(keyOf(row.requesterId, row.formId)) ?? { used: 0, pending: 0 }
    if (row.status === 'approved') {
      entry.used += bookedBy.get(row.id) ?? 0
    } else {
      const asked = timeOffRangeOf(valuesOf(row.values))
      const inYear = 'range' in asked ? clipToYear(asked.range, year) : undefined
      if (inYear) entry.pending += calendar(row.requesterId, inYear.from, inYear.to).length
    }
    tally.set(keyOf(row.requesterId, row.formId), entry)
  }

  const overrideOf = new Map(overrides.map((row) => [keyOf(row.userId, row.formId), row.days]))
  for (const userId of userIds) {
    result.set(
      userId,
      forms.map((form) => {
        const entry = tally.get(keyOf(userId, form.id)) ?? { used: 0, pending: 0 }
        return balanceOf({
          formId: form.id,
          formName: form.name,
          formAllowance: form.leaveAllowance,
          override: overrideOf.get(keyOf(userId, form.id)),
          ...entry,
        })
      }),
    )
  }
  return result
}

/** The caller's balances on the time off forms offered to their department. */
export async function loadMyBalances(requestedYear?: number): Promise<MyLeaveBalances> {
  const caller = await requireRequester()
  const year = requestedYear ?? (await currentYear(caller.organizationId))
  if (!caller.team) return { year, balances: [] }

  const forms = await trackedForms(caller.organizationId, caller.team.id)
  const balances = await balancesFor(caller.organizationId, [caller.userId], forms, year)
  return { year, balances: balances.get(caller.userId) ?? [] }
}

function requireAdmin(caller: RequestCaller) {
  if (!caller.isAdmin) {
    throw new ConnectError('Only an admin can see everyone’s leave.', Code.PermissionDenied)
  }
}

async function peopleOf(organizationId: string, userIds?: readonly string[]) {
  const members = await db.member.findMany({
    where: { organizationId, ...(userIds ? { userId: { in: [...userIds] } } : {}) },
    select: { userId: true, user: { select: { name: true, preferredName: true, banned: true } } },
  })
  return members
    .filter((member) => !member.user.banned)
    .map((member) => ({
      userId: member.userId,
      name: member.user.preferredName ?? member.user.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function allowancesOf(forms: readonly TrackedForm[]): FormAllowance[] {
  return forms.map((form) => ({
    formId: form.id,
    formName: form.name,
    allowance: form.leaveAllowance,
  }))
}

export async function loadTeamBalances(requestedYear?: number): Promise<TeamLeaveBalances> {
  const caller = await requireRequester()
  requireAdmin(caller)
  const year = requestedYear ?? (await currentYear(caller.organizationId))

  const [forms, people] = await Promise.all([
    trackedForms(caller.organizationId),
    peopleOf(caller.organizationId),
  ])
  const balances = await balancesFor(
    caller.organizationId,
    people.map((person) => person.userId),
    forms,
    year,
  )

  return {
    year,
    forms: allowancesOf(forms),
    people: people.map((person) => ({ ...person, balances: balances.get(person.userId) ?? [] })),
  }
}

async function previewTarget(caller: RequestCaller, input: LeavePreviewInput) {
  if ('submissionId' in input) {
    const submission = await db.requestSubmission.findFirst({
      where: { id: input.submissionId, organizationId: caller.organizationId },
      select: { id: true, formId: true, requesterId: true, teamId: true, values: true },
    })
    if (!submission || !canRead(submission, caller)) {
      throw new ConnectError('That request no longer exists.', Code.NotFound)
    }
    return {
      userId: submission.requesterId,
      formId: submission.formId,
      asked: timeOffRangeOf(valuesOf(submission.values)),
      // Its own days are what the preview adds, so they are not pending on top.
      skipSubmissionId: submission.id,
    }
  }

  return {
    userId: caller.userId,
    formId: input.formId,
    asked: timeOffRangeOf({
      [TIME_OFF_FIRST_DAY]: input.firstDay,
      [TIME_OFF_LAST_DAY]: input.lastDay,
    }),
    skipSubmissionId: undefined,
  }
}

/** How many working days a range costs, and the balance it comes out of. */
export async function previewLeave(input: LeavePreviewInput): Promise<LeavePreview> {
  const caller = await requireRequester()
  const target = await previewTarget(caller, input)
  if (!('range' in target.asked)) {
    throw new ConnectError(target.asked.problem, Code.InvalidArgument)
  }
  const range: DateRange = target.asked.range

  const form = await db.requestForm.findFirst({
    where: { id: target.formId, organizationId: caller.organizationId, timeOff: true },
    select: { id: true, name: true, leaveAllowance: true },
  })
  if (!form) throw new ConnectError('That form no longer books time off.', Code.NotFound)

  const calendar = await workingDaysCalendar(caller.organizationId, [target.userId], range)
  const workingDays = calendar(target.userId, range.from, range.to).length
  if (form.leaveAllowance === null) return { workingDays, balance: undefined }

  // A request spanning New Year comes out of the year it starts in.
  const year = Number(range.from.slice(0, 4))
  const balances = await balancesFor(
    caller.organizationId,
    [target.userId],
    [{ id: form.id, name: form.name, leaveAllowance: form.leaveAllowance }],
    year,
    { skipSubmissionId: target.skipSubmissionId },
  )
  return { workingDays, balance: balances.get(target.userId)?.[0] }
}

export async function setAllowance(input: SetAllowanceValues): Promise<PersonBalances> {
  const caller = await requireRequester()
  requireAdmin(caller)
  const parsed = setAllowanceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError('Enter a whole number of days from 0 to 366.', Code.InvalidArgument)
  }
  const values = parsed.data

  const forms = await trackedForms(caller.organizationId)
  if (!forms.some((form) => form.id === values.formId)) {
    throw new ConnectError('That form no longer tracks an allowance.', Code.NotFound)
  }
  const [person] = await peopleOf(caller.organizationId, [values.userId])
  if (!person) throw new ConnectError('That person is no longer a member.', Code.NotFound)

  if (values.days === undefined) {
    await db.leaveAllowance.deleteMany({
      where: { formId: values.formId, userId: values.userId },
    })
  } else {
    await db.leaveAllowance.upsert({
      where: { formId_userId: { formId: values.formId, userId: values.userId } },
      create: {
        organizationId: caller.organizationId,
        formId: values.formId,
        userId: values.userId,
        days: values.days,
      },
      update: { days: values.days },
    })
  }

  const year = await currentYear(caller.organizationId)
  const balances = await balancesFor(caller.organizationId, [person.userId], forms, year)
  return { ...person, balances: balances.get(person.userId) ?? [] }
}
