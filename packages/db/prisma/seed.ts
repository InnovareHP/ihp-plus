// Must come first: it sets DATABASE_URL before the client module reads it.
import './load-env'
import { db } from '../src/client'
import { CATALOG_SEED, DEFAULT_CONTRACT_TERMS, DEFAULT_STANDARD_TERMS } from './catalog'
import { DEMO_CLIENTS } from './client-seed-data'
import { LOOKUP_OPTION_SEED } from './lookup-seed-data'
import { NEW_HIRE_TASK_SEED, REQUIRED_READING_CATEGORIES, SHIFT_SEED } from './new-hire-seed-data'
import { EVALUATION_FORM_SEED, REQUEST_FORM_SEED } from './request-seed-data'

// The company's own departments. Team membership is the single source of truth for them,
// so this list exists here and nowhere else.
const DEPARTMENTS = [
  'Care Management',
  'Clinical Operations',
  'Provider Network',
  'Member Services',
  'Revenue Cycle',
  'Quality & Compliance',
  'Information Technology',
  'Finance',
  'People & Culture',
  'Executive',
] as const

// Only used when the database holds no organization at all; an existing one is adopted, never
// renamed, so a company that edited its own name on the Organization screen keeps it.
const DEFAULT_ORG = { name: 'Innovare Health Partners', slug: 'ihp' }

const ORG_NAME = process.env.ORG_NAME
const ORG_SLUG = process.env.ORG_SLUG
const OWNER_EMAIL = process.env.ORG_OWNER_EMAIL

// Named so a production database can take the reference data without the demo rows:
// `pnpm db:seed lookups teams`. No argument runs them all, which is the dev default.
const STEPS = [
  'teams',
  'lookups',
  'forms',
  'clients',
  'catalog',
  'contract',
  'owner',
  'newhires',
] as const
type Step = (typeof STEPS)[number]

// Membership, approvers and submissions hang off a department, and the owner step only edits
// rows Better Auth owns, so neither has a delete this file is allowed to make.
const WIPEABLE = ['lookups', 'forms', 'clients', 'catalog', 'contract', 'newhires'] as const
type Wipeable = (typeof WIPEABLE)[number]

function requestedSteps(): Set<Step> {
  const names = process.argv.slice(2).filter((argument) => !argument.startsWith('-'))
  const unknown = names.filter((name) => !(STEPS as readonly string[]).includes(name))
  if (unknown.length > 0) {
    throw new Error(`Unknown seed step: ${unknown.join(', ')}. Pick from ${STEPS.join(', ')}.`)
  }
  return new Set(names.length > 0 ? (names as Step[]) : STEPS)
}

/**
 * --wipe deletes what the named steps seed before writing them again, so an edited starter can
 * be replaced by the current one. It refuses to run without named steps: a bare `--wipe` reads
 * like "reset the demo data" and would take the whole organization's content with it.
 */
function wipeSteps(steps: Set<Step>): Set<Wipeable> {
  if (!process.argv.slice(2).includes('--wipe')) return new Set()

  const named = process.argv.slice(2).filter((argument) => !argument.startsWith('-'))
  if (named.length === 0) {
    throw new Error('--wipe needs the steps to wipe, e.g. db:seed forms --wipe.')
  }

  const refused = [...steps].filter((step) => !(WIPEABLE as readonly string[]).includes(step))
  if (refused.length > 0) {
    throw new Error(
      `--wipe cannot delete: ${refused.join(', ')}. Wipeable steps are ${WIPEABLE.join(', ')}.`,
    )
  }

  return new Set(steps as Set<Wipeable>)
}

async function wipe(step: Wipeable, organizationId: string) {
  if (step === 'lookups') {
    const { count } = await db.lookupOption.deleteMany({ where: { organizationId } })
    console.log(`  - ${count} lookup options`)
    return
  }

  if (step === 'clients') {
    const { count } = await db.client.deleteMany({ where: { organizationId } })
    console.log(`  - ${count} clients`)
    return
  }

  if (step === 'catalog') {
    const { count } = await db.catalogItem.deleteMany({ where: { organizationId } })
    console.log(`  - ${count} catalog items`)
    return
  }

  if (step === 'newhires') {
    // Completions cascade with their task; shifts stay, since people may already work them.
    const tasks = await db.newHireTask.deleteMany({ where: { organizationId } })
    const reading = await db.newHireDocument.deleteMany({ where: { organizationId } })
    console.log(`  - ${tasks.count} first-day tasks, ${reading.count} required documents`)
    return
  }

  if (step === 'contract') {
    const { count } = await db.contractTemplate.deleteMany({ where: { organizationId } })
    console.log(`  - ${count} contract templates`)
    return
  }

  await wipeForms(organizationId)
}

/**
 * A submission and an evaluation both snapshot the form they were answered on, but the row
 * still points at it with onDelete: Restrict — so a form anyone has used is kept rather than
 * letting Postgres refuse the whole delete. The seed says which ones stayed.
 */
async function wipeForms(organizationId: string) {
  const forms = await db.requestForm.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      _count: { select: { submissions: true, evaluations: true } },
    },
  })

  const used = forms.filter((form) => form._count.submissions + form._count.evaluations > 0)
  const unused = forms.filter((form) => form._count.submissions + form._count.evaluations === 0)

  if (unused.length > 0) {
    // requestFormTeam cascades with the form; nothing else points at one.
    const { count } = await db.requestForm.deleteMany({
      where: { id: { in: unused.map((form) => form.id) } },
    })
    console.log(`  - ${count} forms`)
  }

  for (const form of used) {
    console.log(
      `  kept ${form.name}: ${form._count.submissions} submissions, ${form._count.evaluations} evaluations`,
    )
  }
}

// Membership rows that carry a plugin-derived membershipKey or memberCount are written by
// Better Auth's own API, never here — this seed only touches tables with plain columns.
async function main() {
  const steps = requestedSteps()
  const wiping = wipeSteps(steps)
  const organization = await currentOrganization()
  console.log(`organization ${organization.slug} (${organization.id})`)
  console.log(`steps: ${[...steps].join(', ')}${wiping.size > 0 ? ' (wiping first)' : ''}`)

  for (const step of wiping) await wipe(step, organization.id)

  if (steps.has('teams')) await seedDepartments(organization.id)
  if (steps.has('lookups')) await seedLookupOptions(organization.id)
  if (steps.has('forms')) await seedRequestForms(organization.id)
  if (steps.has('clients')) await seedDemoClients(organization.id)
  if (steps.has('catalog')) await seedCatalog(organization.id)
  if (steps.has('contract')) await seedContractTemplate(organization.id)
  if (steps.has('owner')) await seedOwner(organization.id)
  if (steps.has('newhires')) await seedNewHireChecklist(organization.id)
}

/**
 * The first-day tasks, the required reading and a starter shift library, then the day shift for
 * any new hire still waiting on one. Every part is create-if-missing, so a re-run never undoes
 * an admin's edit.
 */
async function seedNewHireChecklist(organizationId: string) {
  // newHireTask has no unique title, so existing ones are matched by hand.
  const existingTasks = await db.newHireTask.findMany({
    where: { organizationId, archivedAt: null },
    select: { title: true },
  })
  const taken = new Set(existingTasks.map((task) => task.title))
  const tasks = await db.newHireTask.createMany({
    data: NEW_HIRE_TASK_SEED.filter((task) => !taken.has(task.title)).map((task, index) => ({
      organizationId,
      title: task.title,
      description: task.description,
      sortOrder: existingTasks.length + index,
    })),
  })
  if (tasks.count > 0) console.log(`  + ${tasks.count} first-day tasks`)

  const documents = await db.bluebookDocument.findMany({
    where: { organizationId, archivedAt: null, category: { in: [...REQUIRED_READING_CATEGORIES] } },
    select: { id: true },
  })
  const reading = await db.newHireDocument.createMany({
    data: documents.map((document) => ({ organizationId, documentId: document.id })),
    skipDuplicates: true,
  })
  if (reading.count > 0) console.log(`  + ${reading.count} required documents`)
  if (documents.length === 0) {
    console.log(
      `  no required reading: upload bluebook documents filed as ${REQUIRED_READING_CATEGORIES.join(', ')} and re-run`,
    )
  }

  const shifts = await db.attendanceShift.createMany({
    data: SHIFT_SEED.map((shift) => ({ organizationId, ...shift })),
    skipDuplicates: true,
  })
  if (shifts.count > 0) console.log(`  + ${shifts.count} shifts`)

  const dayShift = await db.attendanceShift.findFirst({
    where: { organizationId, name: SHIFT_SEED[0]?.name },
    select: { id: true },
  })
  if (!dayShift) return

  const [waiting, scheduled] = await Promise.all([
    db.newHireChecklist.findMany({
      where: { organizationId, completedAt: null },
      select: { userId: true },
    }),
    db.attendanceSchedule.findMany({ where: { organizationId }, select: { userId: true } }),
  ])
  const hasShift = new Set(scheduled.map((row) => row.userId))
  const assigned = await db.attendanceSchedule.createMany({
    data: waiting
      .filter((hire) => !hasShift.has(hire.userId))
      .map((hire) => ({ organizationId, userId: hire.userId, shiftId: dayShift.id })),
    skipDuplicates: true,
  })
  if (assigned.count > 0) console.log(`  + day shift for ${assigned.count} new hires`)
}

async function seedDepartments(organizationId: string) {
  for (const name of DEPARTMENTS) {
    // team has no unique constraint on (organizationId, name), so upsert is not available.
    const existing = await db.team.findFirst({
      where: { organizationId, name },
      select: { id: true },
    })
    if (existing) continue
    await db.team.create({
      data: { id: crypto.randomUUID(), name, organizationId, createdAt: new Date() },
    })
    console.log(`  + team ${name}`)
  }
}

async function seedOwner(organizationId: string) {
  if (!OWNER_EMAIL) {
    console.log('ORG_OWNER_EMAIL is unset, so no owner was assigned.')
    return
  }

  const owner = await db.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } })
  if (!owner) {
    console.log(
      `No user with ${OWNER_EMAIL} yet — sign up, then run this again to claim ownership.`,
    )
    return
  }

  const membership = await db.member.findFirst({
    where: { organizationId, userId: owner.id },
    select: { id: true },
  })

  if (membership) {
    await db.member.update({ where: { id: membership.id }, data: { role: 'owner' } })
  } else {
    await db.member.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        userId: owner.id,
        role: 'owner',
        createdAt: new Date(),
      },
    })
  }

  // Organization owner and portal admin are separate roles; the seeded owner gets both.
  await db.user.update({ where: { id: owner.id }, data: { role: 'admin' } })
  console.log(`owner + portal admin: ${OWNER_EMAIL}`)
}

/**
 * One organization is the company: the plugin refuses to let anyone create a second. So the
 * seed adopts the one that is already there rather than upserting on a slug, which quietly
 * created a rival company whenever ORG_SLUG did not match and split departments, options and
 * members across the two with no way to merge them.
 */
async function currentOrganization() {
  const organizations = await db.organization.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  })

  if (organizations.length === 0) {
    return db.organization.create({
      data: {
        id: crypto.randomUUID(),
        name: ORG_NAME ?? DEFAULT_ORG.name,
        slug: ORG_SLUG ?? DEFAULT_ORG.slug,
        createdAt: new Date(),
      },
    })
  }

  // More than one is already a broken state; the seed says so rather than picking for you.
  if (organizations.length > 1) {
    const chosen = ORG_SLUG && organizations.find((candidate) => candidate.slug === ORG_SLUG)
    if (!chosen) {
      const slugs = organizations.map((candidate) => candidate.slug).join(', ')
      throw new Error(
        `This database holds ${organizations.length} organizations (${slugs}). Set ORG_SLUG to say which one to seed.`,
      )
    }
    return chosen
  }

  const [organization] = organizations
  if (!organization) throw new Error('No organization to seed.')

  if (ORG_SLUG && ORG_SLUG !== organization.slug) {
    throw new Error(
      `ORG_SLUG is "${ORG_SLUG}" but the only organization is "${organization.slug}". Refusing to seed a different company.`,
    )
  }

  // Renaming only on an explicit ORG_NAME, so a plain `pnpm db:seed` never undoes an edit.
  if (ORG_NAME && ORG_NAME !== organization.name) {
    await db.organization.update({ where: { id: organization.id }, data: { name: ORG_NAME } })
    console.log(`  renamed to ${ORG_NAME}`)
  }

  return organization
}

// The portal's own dropdowns, seeded the same way and just as idempotent.
async function seedLookupOptions(organizationId: string) {
  for (const [kind, values] of Object.entries(LOOKUP_OPTION_SEED)) {
    const created = await db.lookupOption.createMany({
      data: values.map((value, index) => ({
        id: crypto.randomUUID(),
        organizationId,
        kind,
        value,
        sortOrder: index,
      })),
      skipDuplicates: true,
    })
    if (created.count > 0) console.log(`  + ${created.count} ${kind} options`)
  }
}

/**
 * The forms a company starts with, published so they are usable the moment someone signs in.
 * A form already there is left alone: it is content an admin edits, and a second run must not
 * undo an edit or resurrect a form that was deliberately retired. --wipe is how you replace one.
 */
async function seedRequestForms(organizationId: string) {
  // By name, not by count: a form someone built, or one --wipe had to keep, must not stop the
  // rest of the catalogue from arriving.
  const present = new Set(
    (await db.requestForm.findMany({ where: { organizationId }, select: { name: true } })).map(
      (form) => form.name,
    ),
  )

  const teams = await db.team.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  })
  const idOf = new Map(teams.map((team) => [team.name, team.id]))

  for (const form of REQUEST_FORM_SEED) {
    if (present.has(form.name)) continue

    const teamIds =
      form.departments === 'all'
        ? teams.map((team) => team.id)
        : form.departments
            .map((name) => idOf.get(name))
            .filter((id): id is string => id !== undefined)

    // A published form offered to nobody is a dead entry in the catalogue, which is exactly
    // what the builder refuses to save. Left as a draft for an admin to place instead.
    const placed = teamIds.length > 0

    await db.requestForm.create({
      data: {
        organizationId,
        name: form.name,
        description: form.description,
        status: placed ? 'published' : 'draft',
        fields: form.fields,
        teams: { create: teamIds.map((teamId) => ({ teamId })) },
      },
    })

    console.log(
      placed
        ? `  + form ${form.name} (${teamIds.length} departments)`
        : `  + form ${form.name} (draft: none of its departments exist)`,
    )
  }

  // An evaluation form reaches people by assignment, so it is publishable with no department.
  for (const form of EVALUATION_FORM_SEED) {
    if (present.has(form.name)) continue

    await db.requestForm.create({
      data: {
        organizationId,
        kind: 'evaluation',
        name: form.name,
        description: form.description,
        status: 'published',
        fields: form.fields,
      },
    })

    console.log(`  + evaluation form ${form.name}`)
  }
}

// Demo rows exist so the table, its filters and its sorts have something to show; they are
// written once and never again, so edited demo data is not clobbered.
async function seedDemoClients(organizationId: string) {
  const existing = await db.client.count({ where: { organizationId } })
  if (existing > 0) {
    console.log(`clients already present (${existing}), demo rows skipped`)
    return
  }

  const day = 24 * 60 * 60 * 1000
  await db.client.createMany({
    data: DEMO_CLIENTS.map((client) => ({
      organizationId,
      name: client.name,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      status: client.status,
      type: client.type,
      serviceLine: client.serviceLine,
      source: client.source,
      city: client.city,
      state: client.state,
      tags: client.tags,
      notes: client.notes || null,
      lastContactAt: new Date(Date.now() - client.daysSinceContact * day),
    })),
  })
  console.log(`  + ${DEMO_CLIENTS.length} demo clients`)
}

/**
 * The published rate card, so a new organization can write a contract on day one. createMany
 * with skipDuplicates rather than upsert: a price someone has since edited in the portal is
 * theirs, and a second run must not push it back to the card.
 */
async function seedCatalog(organizationId: string) {
  const created = await db.catalogItem.createMany({
    data: CATALOG_SEED.map((item, index) => ({
      id: crypto.randomUUID(),
      organizationId,
      category: item.category,
      name: item.name,
      description: item.description,
      priceMinCents: item.priceMinCents,
      priceMaxCents: item.priceMaxCents,
      unit: item.unit,
      percentOfSpend: item.percentOfSpend ?? null,
      defaultTerms: item.defaultTerms ?? null,
      sortOrder: index,
    })),
    skipDuplicates: true,
  })
  if (created.count > 0) console.log(`  + ${created.count} catalog items`)

  // Rows seeded before defaultTerms existed hold null, which means "never set" rather than
  // "deliberately blank" — an organization that clears the field leaves an empty string. Only
  // the nulls are filled, so an edit is never undone.
  let filled = 0
  for (const item of CATALOG_SEED) {
    if (!item.defaultTerms) continue
    const updated = await db.catalogItem.updateMany({
      where: { organizationId, category: item.category, name: item.name, defaultTerms: null },
      data: { defaultTerms: item.defaultTerms },
    })
    filled += updated.count
  }
  if (filled > 0) console.log(`  + scope terms on ${filled} catalog items`)
}

/**
 * The boilerplate a contract starts from. Written once and never again: an organization edits
 * its own terms in the portal, and a second run must not undo that.
 */
async function seedContractTemplate(organizationId: string) {
  const existing = await db.contractTemplate.findUnique({
    where: { organizationId },
    select: { id: true },
  })
  if (existing) return

  await db.contractTemplate.create({
    data: {
      organizationId,
      scopeTemplate: DEFAULT_CONTRACT_TERMS,
      standardTerms: DEFAULT_STANDARD_TERMS,
    },
  })
  console.log('  + contract terms template')
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exitCode = 1
  })
