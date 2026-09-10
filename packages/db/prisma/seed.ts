import { db } from '../src/client'

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

const ORG_NAME = process.env.ORG_NAME ?? 'Innovare Health Partners'
const ORG_SLUG = process.env.ORG_SLUG ?? 'ihp'
const OWNER_EMAIL = process.env.ORG_OWNER_EMAIL

// Membership rows that carry a plugin-derived membershipKey or memberCount are written by
// Better Auth's own API, never here — this seed only touches tables with plain columns.
async function main() {
  const organization = await db.organization.upsert({
    where: { slug: ORG_SLUG },
    update: { name: ORG_NAME },
    create: { id: crypto.randomUUID(), name: ORG_NAME, slug: ORG_SLUG, createdAt: new Date() },
  })
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

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exitCode = 1
  })
