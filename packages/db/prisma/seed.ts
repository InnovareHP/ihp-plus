// Must come first: it sets DATABASE_URL before the client module reads it.
import './load-env'
import { db } from '../src/client'
import { CATALOG_SEED } from './catalog'
import { DEMO_CLIENTS } from './client-seed-data'
import { LOOKUP_OPTION_SEED } from './lookup-seed-data'
import { REQUEST_FORM_SEED } from './request-seed-data'

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

// Membership rows that carry a plugin-derived membershipKey or memberCount are written by
// Better Auth's own API, never here — this seed only touches tables with plain columns.
async function main() {
  const organization = await currentOrganization()
  console.log(`organization ${organization.slug} (${organization.id})`)

  for (const name of DEPARTMENTS) {
    // team has no unique constraint on (organizationId, name), so upsert is not available.
    const existing = await db.team.findFirst({
      where: { organizationId: organization.id, name },
      select: { id: true },
    })
    if (existing) continue
    await db.team.create({
      data: {
        id: crypto.randomUUID(),
        name,
        organizationId: organization.id,
        createdAt: new Date(),
      },
    })
    console.log(`  + team ${name}`)
  }

  await seedLookupOptions(organization.id)
  await seedRequestForms(organization.id)
  await seedDemoClients(organization.id)
  await seedCatalog(organization.id)

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
    where: { organizationId: organization.id, userId: owner.id },
    select: { id: true },
  })

  if (membership) {
    await db.member.update({ where: { id: membership.id }, data: { role: 'owner' } })
  } else {
    await db.member.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: organization.id,
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
 * Written once and never again: these are content an admin edits, and a second run must not
 * undo an edit or resurrect a form that was deliberately retired.
 */
async function seedRequestForms(organizationId: string) {
  const existing = await db.requestForm.count({ where: { organizationId } })
  if (existing > 0) {
    console.log(`request forms already present (${existing}), seed skipped`)
    return
  }

  const teams = await db.team.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  })
  const idOf = new Map(teams.map((team) => [team.name, team.id]))

  for (const form of REQUEST_FORM_SEED) {
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
      sortOrder: index,
    })),
    skipDuplicates: true,
  })
  if (created.count > 0) console.log(`  + ${created.count} catalog items`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exitCode = 1
  })
