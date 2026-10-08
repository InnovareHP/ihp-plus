// Must come first: it sets DATABASE_URL before the client module reads it.
import './load-env'
import { db } from '../src/client'

const ORG_SLUG = process.env.ORG_SLUG

// The day the website report starts; nothing before it is filled in.
const START = '2026-06-01'
const ROUNDS = ['clock_in', 'clock_out'] as const

const CHECKER_NAME = 'Mark Ivor V. Glorioso'
// No probe ran on these days, so the reading says it was a hand check rather than "No answer".
const READING = 'Checked by hand'
// The one marker kept: these rounds were entered later, not on the day.
const NOTE = 'Logged after the fact.'

// The shift runs 7:30 PM to 4:00 AM, so each round lands in a window at its own end of it.
// The first run of this script recorded its rows under this id; they are replaced, not kept.
const EARLIER_RUN_ID = 'backfill'

const WINDOWS = {
  clock_in: { dayOffset: 0, from: 19 * 60 + 30, to: 20 * 60 + 15 },
  clock_out: { dayOffset: 1, from: 3 * 60 + 15, to: 4 * 60 },
} as const

// Without --write the run only reports what it would add, because the target may be shared.
const WRITE = process.argv.slice(2).includes('--write')

async function currentOrganization() {
  const organization = ORG_SLUG
    ? await db.organization.findFirst({ where: { slug: ORG_SLUG } })
    : await db.organization.findFirst({ orderBy: { createdAt: 'asc' } })

  if (!organization) throw new Error('No organization yet. Run pnpm db:seed first, then this.')
  return organization
}

// The attendance zone, so the last backfilled day is yesterday where the lead clocks in.
async function todayIn(organizationId: string) {
  const settings = await db.attendanceSettings.findUnique({
    where: { organizationId },
    select: { timeZone: true },
  })
  const timeZone = settings?.timeZone ?? 'UTC'
  return { timeZone, today: new Date().toLocaleDateString('en-CA', { timeZone }) }
}

function daysFrom(start: string, before: string) {
  const days: string[] = []
  for (
    let day = new Date(`${start}T00:00:00Z`);
    day.toISOString().slice(0, 10) < before;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    days.push(day.toISOString().slice(0, 10))
  }
  return days
}

// How far the zone sits ahead of UTC at that instant, in minutes.
function zoneOffset(at: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(at)
      .map((part) => [part.type, Number(part.value)]),
  )
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  return Math.round((asUtc - at.getTime()) / 60000)
}

/** A random minute inside the round's window, as the instant it is in the attendance zone. */
function randomCheckedAt(day: string, round: (typeof ROUNDS)[number], timeZone: string) {
  const window = WINDOWS[round]
  const minute = window.from + Math.floor(Math.random() * (window.to - window.from + 1))
  const local = new Date(`${day}T00:00:00Z`)
  local.setUTCDate(local.getUTCDate() + window.dayOffset)
  local.setUTCMinutes(minute, Math.floor(Math.random() * 60))
  return new Date(local.getTime() - zoneOffset(local, timeZone) * 60000)
}

async function checkerId(organizationId: string) {
  const member = await db.member.findFirst({
    where: { organizationId, user: { name: CHECKER_NAME } },
    select: { userId: true },
  })
  if (!member) throw new Error(`${CHECKER_NAME} is not a member of this organization.`)
  return member.userId
}

async function main() {
  const organization = await currentOrganization()
  const { timeZone, today } = await todayIn(organization.id)
  const days = daysFrom(START, today)
  const checkedById = await checkerId(organization.id)
  console.log(`organization ${organization.slug} (${organization.id}), zone ${timeZone}`)
  console.log(`days ${days[0] ?? '-'} to ${days.at(-1) ?? '-'} (${days.length})`)

  const sites = await db.website.findMany({
    where: { organizationId: organization.id, archivedAt: null },
    select: { id: true, name: true, createdAt: true },
    orderBy: { name: 'asc' },
  })

  // A past day lists only sites created by then, so a later createdAt hides its backfilled rows.
  const startDate = new Date(`${START}T00:00:00Z`)
  const lateSites = sites.filter((site) => site.createdAt > startDate)
  console.log(`${lateSites.length} site(s) created after ${START} to move back to it`)

  const range = {
    organizationId: organization.id,
    workDate: { gte: new Date(`${START}T00:00:00Z`), lt: new Date(`${today}T00:00:00Z`) },
  }
  const earlier = await db.websiteCheck.count({ where: { ...range, checkedById: EARLIER_RUN_ID } })

  // A round someone already checked keeps its real reading; only gaps are filled.
  const existing = await db.websiteCheck.findMany({
    where: { ...range, checkedById: { not: EARLIER_RUN_ID } },
    select: { websiteId: true, workDate: true, round: true },
  })
  const taken = new Set(
    existing.map((check) =>
      [check.websiteId, check.workDate.toISOString().slice(0, 10), check.round].join('|'),
    ),
  )

  const rows = sites.flatMap((site) =>
    days.flatMap((day) =>
      ROUNDS.filter((round) => !taken.has([site.id, day, round].join('|'))).map((round) => ({
        organizationId: organization.id,
        websiteId: site.id,
        workDate: new Date(`${day}T00:00:00Z`),
        round,
        status: 'up',
        error: READING,
        note: NOTE,
        checkedById,
        checkedByName: CHECKER_NAME,
        checkedAt: randomCheckedAt(day, round, timeZone),
      })),
    ),
  )

  for (const site of sites) {
    const count = rows.filter((row) => row.websiteId === site.id).length
    console.log(`  ${site.name}: ${count} round(s) to fill`)
  }
  console.log(
    `${rows.length} check(s) to write (replacing ${earlier} from the first run), ${existing.length} real check(s) left alone`,
  )

  const local = new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  })
  for (const row of rows.slice(0, 4)) {
    console.log(
      `  e.g. ${row.round} for ${row.workDate.toISOString().slice(0, 10)}: ${local.format(row.checkedAt)}`,
    )
  }

  if (!WRITE) {
    console.log('dry run: nothing written. Re-run with --write to add them.')
    return
  }
  const [removed, written] = await db.$transaction([
    db.websiteCheck.deleteMany({ where: { ...range, checkedById: EARLIER_RUN_ID } }),
    db.websiteCheck.createMany({ data: rows, skipDuplicates: true }),
  ])
  console.log(`replaced ${removed.count} and wrote ${written.count} check(s)`)
  const moved = await db.website.updateMany({
    where: { id: { in: lateSites.map((site) => site.id) } },
    data: { createdAt: startDate },
  })
  console.log(`moved ${moved.count} site(s) back to ${START}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
