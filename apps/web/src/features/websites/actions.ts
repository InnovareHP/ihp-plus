'use server'

import { db } from '@ihp/db'
import { shiftDateKey, workDateKey } from '@ihp/clock'
import { websitesAccess, type WebsitesCaller } from './access'
import { runRoundFor, timeZoneOf } from './service'
import {
  CHECK_ROUNDS,
  dateKeySchema,
  itTeamSchema,
  exportMonthSchema,
  recordCheckSchema,
  updateWebsiteSchema,
  websiteDraftSchema,
  type CheckRound,
  type CheckStatus,
  type Checklist,
  type ClientOption,
  type ExportMonthValues,
  type ItTeamValues,
  type MonthExport,
  type RecordCheckValues,
  type UpdateWebsiteValues,
  type WebsiteCheckRow,
  type WebsiteDraftInput,
  type WebsiteOption,
  type WebsiteRow,
} from './schema'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }

const NOT_FOUND = 'This page is only for the IT department.'
const NOT_LEAD = 'Only the IT lead runs the time-in and time-out checks.'
const NOT_MANAGER = 'Only the IT lead or an admin can change the website list.'
const INVALID = 'Check the highlighted fields and try again.'
const GONE = 'That website is no longer on the list.'

type Viewer = WebsitesCaller & { organizationId: string }

async function viewer(): Promise<Viewer | undefined> {
  const access = await websitesAccess()
  if (!access.canView || !access.organizationId) return undefined
  return { ...access, organizationId: access.organizationId }
}

function dateOf(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

function dateKeyOf(date: Date) {
  return date.toISOString().slice(0, 10)
}

interface CheckRecord {
  websiteId: string
  workDate: Date
  round: string
  status: string
  httpStatus: number | null
  responseMs: number | null
  error: string
  note: string
  checkedByName: string
  checkedAt: Date
}

function checkRowOf(check: CheckRecord): WebsiteCheckRow {
  return {
    status: check.status as CheckStatus,
    httpStatus: check.httpStatus ?? undefined,
    responseMs: check.responseMs ?? undefined,
    error: check.error,
    note: check.note,
    checkedByName: check.checkedByName,
    checkedAt: check.checkedAt.toISOString(),
  }
}

function checksByRound(checks: readonly CheckRecord[]) {
  const byRound: Partial<Record<CheckRound, WebsiteCheckRow>> = {}
  for (const check of checks) {
    if ((CHECK_ROUNDS as readonly string[]).includes(check.round)) {
      byRound[check.round as CheckRound] = checkRowOf(check)
    }
  }
  return byRound
}

async function clientNames(organizationId: string, ids: readonly string[]) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map<string, string>()
  const clients = await db.client.findMany({
    where: { organizationId, id: { in: unique } },
    select: { id: true, name: true },
  })
  return new Map(clients.map((client) => [client.id, client.name]))
}

interface WebsiteRecord {
  id: string
  name: string
  url: string
  clientId: string | null
  notes: string
}

function websiteRowOf(
  site: WebsiteRecord,
  names: Map<string, string>,
  checks: readonly CheckRecord[],
): WebsiteRow {
  return {
    id: site.id,
    name: site.name,
    url: site.url,
    clientId: site.clientId ?? '',
    clientName: site.clientId ? (names.get(site.clientId) ?? '') : '',
    notes: site.notes,
    checks: checksByRound(checks.filter((check) => check.websiteId === site.id)),
  }
}

/** Sites that were on the list that day: added by then and not yet archived. */
function onListDuring(organizationId: string, from: Date, until: Date) {
  return {
    organizationId,
    createdAt: { lt: until },
    OR: [{ archivedAt: null }, { archivedAt: { gte: from } }],
  }
}

async function checklistFor(caller: Viewer, date: string, today: string, timeZone: string) {
  const day = dateOf(date)
  const isToday = date === today
  const sites = await db.website.findMany({
    // Today shows the live list; a past day shows what was being watched back then.
    where: isToday
      ? { organizationId: caller.organizationId, archivedAt: null }
      : onListDuring(caller.organizationId, day, dateOf(shiftDateKey(date, 1))),
    orderBy: { name: 'asc' },
    select: { id: true, name: true, url: true, clientId: true, notes: true },
  })
  const [checks, names] = await Promise.all([
    db.websiteCheck.findMany({
      where: { organizationId: caller.organizationId, workDate: day },
    }),
    clientNames(
      caller.organizationId,
      sites.map((site) => site.clientId ?? ''),
    ),
  ])

  return {
    date,
    today,
    timeZone,
    websites: sites.map((site) => websiteRowOf(site, names, checks)),
  } satisfies Checklist
}

export async function loadChecklist(date?: string): Promise<Result<Checklist>> {
  const caller = await viewer()
  if (!caller) return { ok: false, message: NOT_FOUND }

  const timeZone = await timeZoneOf(caller.organizationId)
  const today = workDateKey(new Date(), timeZone)
  const parsed = dateKeySchema.safeParse(date)
  // A future date has nothing to show yet, so it falls back to today like a missing one.
  const wanted = parsed.success && parsed.data <= today ? parsed.data : today

  return { ok: true, data: await checklistFor(caller, wanted, today, timeZone) }
}

export async function listClientOptions(): Promise<Result<ClientOption[]>> {
  const caller = await viewer()
  if (!caller) return { ok: false, message: NOT_FOUND }

  const clients = await db.client.findMany({
    where: { organizationId: caller.organizationId, archivedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  return { ok: true, data: clients }
}

async function checkedClientId(organizationId: string, clientId: string) {
  if (!clientId) return null
  const client = await db.client.findFirst({
    where: { id: clientId, organizationId },
    select: { id: true },
  })
  return client?.id
}

async function savedRow(caller: Viewer, id: string): Promise<WebsiteRow | undefined> {
  const site = await db.website.findFirst({
    where: { id, organizationId: caller.organizationId },
    select: { id: true, name: true, url: true, clientId: true, notes: true },
  })
  if (!site) return undefined
  const timeZone = await timeZoneOf(caller.organizationId)
  const [names, checks] = await Promise.all([
    clientNames(caller.organizationId, [site.clientId ?? '']),
    db.websiteCheck.findMany({
      where: { websiteId: id, workDate: dateOf(workDateKey(new Date(), timeZone)) },
    }),
  ])
  return websiteRowOf(site, names, checks)
}

export async function createWebsite(input: WebsiteDraftInput): Promise<Result<WebsiteRow>> {
  const caller = await viewer()
  if (!caller) return { ok: false, message: NOT_FOUND }
  if (!caller.canManage) return { ok: false, message: NOT_MANAGER }

  const parsed = websiteDraftSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const clientId = await checkedClientId(caller.organizationId, parsed.data.clientId)
  if (clientId === undefined) return { ok: false, message: 'That client no longer exists.' }

  const site = await db.website.create({
    data: {
      organizationId: caller.organizationId,
      createdById: caller.userId,
      clientId,
      name: parsed.data.name,
      url: parsed.data.url,
      notes: parsed.data.notes.trim(),
    },
    select: { id: true },
  })
  const row = await savedRow(caller, site.id)
  return row ? { ok: true, data: row } : { ok: false, message: GONE }
}

export async function updateWebsite(input: UpdateWebsiteValues): Promise<Result<WebsiteRow>> {
  const caller = await viewer()
  if (!caller) return { ok: false, message: NOT_FOUND }
  if (!caller.canManage) return { ok: false, message: NOT_MANAGER }

  const parsed = updateWebsiteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const clientId = await checkedClientId(caller.organizationId, parsed.data.clientId)
  if (clientId === undefined) return { ok: false, message: 'That client no longer exists.' }

  const updated = await db.website.updateMany({
    where: { id: parsed.data.id, organizationId: caller.organizationId, archivedAt: null },
    data: {
      clientId,
      name: parsed.data.name,
      url: parsed.data.url,
      notes: parsed.data.notes.trim(),
    },
  })
  if (updated.count === 0) return { ok: false, message: GONE }

  const row = await savedRow(caller, parsed.data.id)
  return row ? { ok: true, data: row } : { ok: false, message: GONE }
}

async function setArchived(id: string, archivedAt: Date | null): Promise<Result<null>> {
  const caller = await viewer()
  if (!caller) return { ok: false, message: NOT_FOUND }
  if (!caller.canManage) return { ok: false, message: NOT_MANAGER }

  const updated = await db.website.updateMany({
    where: { id, organizationId: caller.organizationId },
    data: { archivedAt },
  })
  return updated.count > 0 ? { ok: true, data: null } : { ok: false, message: GONE }
}

export async function archiveWebsite({ id }: { id: string }) {
  return setArchived(id, new Date())
}

export async function restoreWebsite({ id }: { id: string }) {
  return setArchived(id, null)
}

export async function runRound(input: {
  round: CheckRound
  websiteId?: string
}): Promise<Result<Checklist>> {
  const caller = await viewer()
  if (!caller) return { ok: false, message: NOT_FOUND }
  if (!caller.canCheck) return { ok: false, message: NOT_LEAD }
  if (!(CHECK_ROUNDS as readonly string[]).includes(input.round)) {
    return { ok: false, message: INVALID }
  }

  const { today, checked } = await runRoundFor(caller, input.round, {
    websiteId: input.websiteId,
  })
  if (input.websiteId && checked === 0) return { ok: false, message: GONE }

  const timeZone = await timeZoneOf(caller.organizationId)
  return { ok: true, data: await checklistFor(caller, today, today, timeZone) }
}

/** The lead's own verdict on one site, for what a status code cannot see. */
export async function recordCheck(input: RecordCheckValues): Promise<Result<WebsiteRow>> {
  const caller = await viewer()
  if (!caller) return { ok: false, message: NOT_FOUND }
  if (!caller.canCheck) return { ok: false, message: NOT_LEAD }

  const parsed = recordCheckSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }
  const values = parsed.data
  if (values.status !== 'up' && !values.note) {
    return { ok: false, message: 'Say what is wrong so the next person knows.' }
  }

  const site = await db.website.findFirst({
    where: { id: values.websiteId, organizationId: caller.organizationId, archivedAt: null },
    select: { id: true },
  })
  if (!site) return { ok: false, message: GONE }

  const timeZone = await timeZoneOf(caller.organizationId)
  const workDate = dateOf(workDateKey(new Date(), timeZone))
  const verdict = {
    status: values.status,
    note: values.note,
    checkedById: caller.userId,
    checkedByName: caller.userName,
    checkedAt: new Date(),
  }
  await db.websiteCheck.upsert({
    where: { websiteId_workDate_round: { websiteId: site.id, workDate, round: values.round } },
    create: {
      organizationId: caller.organizationId,
      websiteId: site.id,
      workDate,
      round: values.round,
      ...verdict,
    },
    update: verdict,
  })

  const row = await savedRow(caller, site.id)
  return row ? { ok: true, data: row } : { ok: false, message: GONE }
}

/** Every site ever watched, removed ones too, so last month's report can still pick them. */
export async function listWebsiteOptions(): Promise<Result<WebsiteOption[]>> {
  const caller = await viewer()
  if (!caller) return { ok: false, message: NOT_FOUND }

  const sites = await db.website.findMany({
    where: { organizationId: caller.organizationId },
    orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
    select: { id: true, name: true, archivedAt: true },
  })
  return {
    ok: true,
    data: sites.map((site) => ({
      id: site.id,
      name: site.name,
      removed: Boolean(site.archivedAt),
    })),
  }
}

export async function exportMonth(input: ExportMonthValues): Promise<Result<MonthExport>> {
  const caller = await viewer()
  if (!caller) return { ok: false, message: NOT_FOUND }

  const parsed = exportMonthSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Pick a month to download.' }
  const month = parsed.data.month
  const websiteId = parsed.data.websiteId

  const timeZone = await timeZoneOf(caller.organizationId)
  const today = workDateKey(new Date(), timeZone)
  const first = `${month}-01`
  if (first > today) return { ok: false, message: 'That month has not started yet.' }

  const dates: string[] = []
  for (let date = first; date.startsWith(month) && date <= today;) {
    dates.push(date)
    date = shiftDateKey(date, 1)
  }
  const last = dates[dates.length - 1] ?? first
  const from = dateOf(first)
  const until = dateOf(shiftDateKey(last, 1))

  const [sites, checks] = await Promise.all([
    db.website.findMany({
      where: {
        ...onListDuring(caller.organizationId, from, until),
        ...(websiteId ? { id: websiteId } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        url: true,
        clientId: true,
        createdAt: true,
        archivedAt: true,
      },
    }),
    db.websiteCheck.findMany({
      where: {
        organizationId: caller.organizationId,
        workDate: { gte: from, lt: until },
        ...(websiteId ? { websiteId } : {}),
      },
    }),
  ])
  const names = await clientNames(
    caller.organizationId,
    sites.map((site) => site.clientId ?? ''),
  )
  const byKey = new Map<string, CheckRecord[]>()
  for (const check of checks) {
    const key = `${check.websiteId}:${dateKeyOf(check.workDate)}`
    byKey.set(key, [...(byKey.get(key) ?? []), check])
  }

  const rows = dates.flatMap((date) => {
    const dayStart = dateOf(date)
    const dayEnd = dateOf(shiftDateKey(date, 1))
    return sites
      .filter(
        (site) => site.createdAt < dayEnd && (!site.archivedAt || site.archivedAt >= dayStart),
      )
      .map((site) => ({
        date,
        website: site.name,
        url: site.url,
        client: site.clientId ? (names.get(site.clientId) ?? '') : '',
        checks: checksByRound(byKey.get(`${site.id}:${date}`) ?? []),
      }))
  })

  // A site picked for the report is on the list even in a month it had no rows.
  const picked = websiteId
    ? await db.website.findFirst({
        where: { id: websiteId, organizationId: caller.organizationId },
        select: { name: true },
      })
    : undefined
  if (websiteId && !picked) return { ok: false, message: 'That website no longer exists.' }

  return { ok: true, data: { month, timeZone, websiteName: picked?.name, rows } }
}

export async function saveItTeam(input: ItTeamValues): Promise<Result<{ itTeamId: string }>> {
  const access = await websitesAccess()
  if (!access.organizationId || !access.canConfigure) {
    return { ok: false, message: 'Only an admin can choose the IT department.' }
  }

  const parsed = itTeamSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const itTeamId = parsed.data.itTeamId || null
  if (itTeamId) {
    const team = await db.team.findFirst({
      where: { id: itTeamId, organizationId: access.organizationId },
      select: { id: true },
    })
    if (!team) return { ok: false, message: 'That department no longer exists.' }
  }

  await db.websiteSettings.upsert({
    where: { organizationId: access.organizationId },
    create: { organizationId: access.organizationId, itTeamId },
    update: { itTeamId },
  })
  return { ok: true, data: { itTeamId: itTeamId ?? '' } }
}
