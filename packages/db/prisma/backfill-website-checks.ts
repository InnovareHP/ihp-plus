// Must come first: it sets DATABASE_URL before the client module reads it.
import './load-env'
import { db } from '../src/client'

const ORG_SLUG = process.env.ORG_SLUG

// The day the website report starts; nothing before it is filled in.
const START = '2026-06-01'
const ROUNDS = ['clock_in', 'clock_out'] as const

// Every backfilled row says so in the file, so nobody reads it as a check someone made.
const BACKFILL_BY_ID = 'backfill'
const BACKFILL_BY_NAME = 'Backfill'
const BACKFILL_READING = 'Not probed — backfilled'
const BACKFILL_NOTE = 'No check was recorded at the time; backfilled as running.'

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

async function main() {
  const organization = await currentOrganization()
  const { timeZone, today } = await todayIn(organization.id)
  const days = daysFrom(START, today)
  console.log(`organization ${organization.slug} (${organization.id}), zone ${timeZone}`)
  console.log(`days ${days[0] ?? '-'} to ${days.at(-1) ?? '-'} (${days.length})`)

  const sites = await db.website.findMany({
    where: { organizationId: organization.id, archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // A round someone already checked keeps its real reading; only gaps are filled.
  const existing = await db.websiteCheck.findMany({
    where: {
      organizationId: organization.id,
      workDate: { gte: new Date(`${START}T00:00:00Z`), lt: new Date(`${today}T00:00:00Z`) },
    },
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
        error: BACKFILL_READING,
        note: BACKFILL_NOTE,
        checkedById: BACKFILL_BY_ID,
        checkedByName: BACKFILL_BY_NAME,
      })),
    ),
  )

  for (const site of sites) {
    const count = rows.filter((row) => row.websiteId === site.id).length
    console.log(`  ${site.name}: ${count} round(s) to fill`)
  }
  console.log(`${rows.length} check(s) to add, ${existing.length} real check(s) left alone`)

  if (!WRITE) {
    console.log('dry run: nothing written. Re-run with --write to add them.')
    return
  }
  const { count } = await db.websiteCheck.createMany({ data: rows, skipDuplicates: true })
  console.log(`wrote ${count} check(s)`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
