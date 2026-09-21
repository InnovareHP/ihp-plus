// Must come first: it sets DATABASE_URL before the client module reads it.
import './load-env'
import { db } from '../src/client'
import { DEMO_CLIENTS } from './client-seed-data'
import { IHP_CLIENT_LOOKUPS, IHP_CLIENTS, type IhpClient } from './ihp-client-seed-data'

const ORG_SLUG = process.env.ORG_SLUG

// A real roster, so it is written once and never again: an edit made in the portal is the
// truth afterwards. --replace removes the demo rows this file supersedes, by name and nothing
// else, so a client someone added by hand is never caught by it.
const REPLACE = process.argv.slice(2).includes('--replace')

async function currentOrganization() {
  const organization = ORG_SLUG
    ? await db.organization.findFirst({ where: { slug: ORG_SLUG } })
    : await db.organization.findFirst({ orderBy: { createdAt: 'asc' } })

  if (!organization) {
    throw new Error('No organization yet. Run pnpm db:seed first, then this.')
  }
  return organization
}

/**
 * Account owners are people, and this script cannot create them — a name with no matching user
 * leaves the client unowned rather than failing the run, and a later run claims it once that
 * person has signed up.
 */
async function ownerIds(organizationId: string, names: string[]) {
  const members = await db.member.findMany({
    where: { organizationId },
    select: { user: { select: { id: true, name: true, firstName: true, lastName: true } } },
  })

  const byName = new Map<string, string>()
  for (const { user } of members) {
    const full = [user.firstName, user.lastName].filter(Boolean).join(' ')
    byName.set(user.name.toLowerCase(), user.id)
    if (full) byName.set(full.toLowerCase(), user.id)
  }

  const resolved = new Map<string, string>()
  for (const name of names) {
    const id = byName.get(name.toLowerCase())
    if (id) resolved.set(name, id)
    else console.log(`  ! no user named ${name} — their clients stay unowned`)
  }
  return resolved
}

// The roster's types and service lines have to be pickable in the portal, not just stored.
async function seedLookups(organizationId: string) {
  for (const [kind, values] of Object.entries(IHP_CLIENT_LOOKUPS)) {
    const last = await db.lookupOption.findFirst({
      where: { organizationId, kind },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const created = await db.lookupOption.createMany({
      data: values.map((value, index) => ({
        id: crypto.randomUUID(),
        organizationId,
        kind,
        value,
        sortOrder: (last?.sortOrder ?? -1) + 1 + index,
      })),
      skipDuplicates: true,
    })
    if (created.count > 0) console.log(`  + ${created.count} ${kind} options`)
  }
}

async function removeDemoClients(organizationId: string) {
  const { count } = await db.client.deleteMany({
    where: { organizationId, name: { in: DEMO_CLIENTS.map((client) => client.name) } },
  })
  console.log(`  - ${count} demo clients`)
}

async function seedClients(organizationId: string, owners: Map<string, string>) {
  // client has no unique constraint on (organizationId, name), so presence is read up front.
  const present = new Set(
    (await db.client.findMany({ where: { organizationId }, select: { name: true } })).map(
      (client) => client.name.toLowerCase(),
    ),
  )

  const incoming = IHP_CLIENTS.filter((client) => !present.has(client.name.toLowerCase()))
  if (incoming.length === 0) {
    console.log('  all clients already present')
    return
  }

  await db.client.createMany({
    data: incoming.map((client: IhpClient) => ({
      organizationId,
      ownerId: client.ownerName ? (owners.get(client.ownerName) ?? null) : null,
      name: client.name,
      status: 'active',
      type: client.type ?? null,
      serviceLine: client.serviceLine ?? null,
      tags: client.tags ?? [],
      notes: client.notes ?? null,
    })),
  })
  console.log(`  + ${incoming.length} clients`)

  const skipped = IHP_CLIENTS.length - incoming.length
  if (skipped > 0) console.log(`  = ${skipped} already present, left alone`)
}

async function main() {
  const organization = await currentOrganization()
  console.log(`organization ${organization.slug} (${organization.id})`)

  if (REPLACE) await removeDemoClients(organization.id)

  await seedLookups(organization.id)
  const names = [...new Set(IHP_CLIENTS.map((client) => client.ownerName).filter(Boolean))]
  await seedClients(organization.id, await ownerIds(organization.id, names as string[]))
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exitCode = 1
  })
