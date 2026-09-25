import { workDateKey } from '@ihp/clock'
import { db } from '@ihp/db'
import { DEFAULT_BULLETIN_SETTINGS } from './schema'
import { dueCelebrations, type CelebrationPerson } from './utils/celebrations'

/**
 * Writes today's birthdays, work anniversaries and welcomes to every organization's board.
 * Idempotent: each post carries an occasion key the table holds unique, so a rerun adds nothing.
 */
export async function postCelebrations(now: Date = new Date()): Promise<number> {
  const [organizations, settings, zones, members] = await Promise.all([
    db.organization.findMany({ select: { id: true } }),
    db.bulletinSettings.findMany(),
    // The attendance clock already owns the company's zone; a birthday uses the same midnight.
    db.attendanceSettings.findMany({ select: { organizationId: true, timeZone: true } }),
    db.member.findMany({
      where: { user: { banned: { not: true } } },
      select: {
        organizationId: true,
        userId: true,
        user: {
          select: {
            name: true,
            preferredName: true,
            dateOfBirth: true,
            startDate: true,
            onboardingCompletedAt: true,
          },
        },
      },
    }),
  ])

  const settingsByOrg = new Map(settings.map((row) => [row.organizationId, row]))
  const zoneByOrg = new Map(zones.map((row) => [row.organizationId, row.timeZone]))
  let created = 0

  for (const organization of organizations) {
    const people: CelebrationPerson[] = members
      .filter((member) => member.organizationId === organization.id)
      .map((member) => ({
        userId: member.userId,
        name: member.user.preferredName ?? member.user.name,
        dateOfBirth: member.user.dateOfBirth,
        startDate: member.user.startDate,
        onboardingCompletedAt: member.user.onboardingCompletedAt,
      }))

    const today = workDateKey(now, zoneByOrg.get(organization.id) ?? 'UTC')
    const due = dueCelebrations(
      people,
      settingsByOrg.get(organization.id) ?? DEFAULT_BULLETIN_SETTINGS,
      today,
      now,
    )
    if (due.length === 0) continue

    const result = await db.bulletinPost.createMany({
      data: due.map((celebration) => ({
        organizationId: organization.id,
        authorId: null,
        kind: celebration.kind,
        subjectUserId: celebration.subjectUserId,
        occasionKey: celebration.occasionKey,
        body: celebration.body,
      })),
      skipDuplicates: true,
    })
    created += result.count
  }

  return created
}
