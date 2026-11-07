import { db } from '@ihp/db'
import {
  portalUrl,
  sendEmail,
  websiteExpiryAlertTemplate,
  websiteExpiryReportTemplate,
} from '@/lib/email'
import { routes } from '@/lib/routes'
import { itTeamIdOf } from './access'
import { expiryOf } from './expiry'
import { timeZoneOf } from './service'
import { alertLines, expiringSoonCount, monthlyLines, type SiteExpiry } from './utils/expiry-lines'

export const EXPIRY_EMAIL_KINDS = ['monthly', 'alerts'] as const
export type ExpiryEmailKind = (typeof EXPIRY_EMAIL_KINDS)[number]

export interface ExpiryRunSummary {
  organizations: number
  sites: number
  emailed: number
  /** Organizations skipped because no IT department or lead is set, so nobody would hear. */
  noLead: number
}

/** Whoever leads the IT department; the page's own role check names the same people. */
async function leadEmails(organizationId: string) {
  const itTeamId = await itTeamIdOf(organizationId)
  if (!itTeamId) return []
  const leads = await db.teamLead.findMany({
    where: { organizationId, teamId: itTeamId },
    select: { userId: true },
  })
  if (leads.length === 0) return []
  const users = await db.user.findMany({
    where: { id: { in: leads.map((lead) => lead.userId) } },
    select: { email: true, banned: true },
  })
  return users.filter((user) => !user.banned).map((user) => user.email)
}

const monthTitle = (now: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone, month: 'long', year: 'numeric' }).format(now)

/**
 * The monthly run emails every site's dates; the daily run emails only renewals that land on an
 * alert day, so most days send nothing. Neither stores anything: each run reads the dates fresh.
 */
export async function runExpiryEmails(
  kind: ExpiryEmailKind,
  now = new Date(),
): Promise<ExpiryRunSummary> {
  const summary: ExpiryRunSummary = { organizations: 0, sites: 0, emailed: 0, noLead: 0 }
  const watching = await db.website.findMany({
    where: { archivedAt: null },
    distinct: ['organizationId'],
    select: { organizationId: true },
  })

  for (const { organizationId } of watching) {
    summary.organizations += 1
    const recipients = await leadEmails(organizationId)
    if (recipients.length === 0) {
      summary.noLead += 1
      continue
    }

    const sites = await db.website.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { name: 'asc' },
      select: { name: true, url: true },
    })
    // Every site at once; each lookup has its own timeout, so one slow registry costs one wait.
    const expiries: SiteExpiry[] = await Promise.all(
      sites.map(async (site) => ({ name: site.name, ...(await expiryOf(site.url)) })),
    )
    summary.sites += expiries.length

    const timeZone = await timeZoneOf(organizationId)
    const url = portalUrl(routes.websites)
    let email
    if (kind === 'monthly') {
      email = websiteExpiryReportTemplate({
        monthLabel: monthTitle(now, timeZone),
        sites: monthlyLines(expiries, timeZone, now),
        expiringSoon: expiringSoonCount(expiries, now),
        url,
      })
    } else {
      const alerts = alertLines(expiries, timeZone, now)
      if (alerts.length === 0) continue
      email = websiteExpiryAlertTemplate({ alerts, url })
    }

    for (const to of recipients) {
      // One failed address must not stop another lead hearing.
      try {
        const sent = await sendEmail({ to, ...email })
        if (sent.delivered) summary.emailed += 1
      } catch (error) {
        console.error('[websites] could not email domain and SSL dates', error)
      }
    }
  }

  return summary
}
