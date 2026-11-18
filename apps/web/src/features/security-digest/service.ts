import { db } from '@ihp/db'
import { workDateKey } from '@ihp/clock'
import {
  isEmailConfigured,
  securityDigestTemplate,
  sendEmail,
  SECURITY_DIGEST_HERO_ID,
} from '@/lib/email'
import { timeZoneOf } from '@/features/websites/service'
import { DigestAiError, generateIssue, isAiConfigured } from './generate'
import { digestGraphicBytes } from './graphic'
import {
  DIGEST_TOPICS,
  type DeliveryStatus,
  type DigestOverview,
  type DigestStatus,
  type DigestTopic,
  type IssueRow,
  type SettingsValues,
} from './schema'
import { nextSendOn, nextTopic, recipientsOf } from './utils/schedule'

const DEFAULT_SETTINGS: SettingsValues = {
  enabled: false,
  recipients: [],
  includeClients: false,
  reportTo: '',
}

export const NO_RECIPIENTS = 'Nobody to send to — add a recipient.'

const RECENT_TITLES = 8
const HISTORY = 26

export async function settingsOf(organizationId: string): Promise<SettingsValues> {
  const row = await db.securityDigestSettings.findUnique({ where: { organizationId } })
  if (!row) return DEFAULT_SETTINGS
  return {
    enabled: row.enabled,
    recipients: row.recipients,
    includeClients: row.includeClients,
    reportTo: row.reportTo,
  }
}

export async function saveSettings(organizationId: string, values: SettingsValues) {
  await db.securityDigestSettings.upsert({
    where: { organizationId },
    create: { organizationId, ...values },
    update: values,
  })
}

/** Active clients with an address on file; prospects and archived clients never get mail. */
async function clientEmails(organizationId: string) {
  const clients = await db.client.findMany({
    where: { organizationId, archivedAt: null, status: 'active', email: { not: null } },
    select: { email: true },
  })
  return clients.flatMap((client) => (client.email ? [client.email] : []))
}

export async function recipientsFor(organizationId: string, settings: SettingsValues) {
  return recipientsOf(
    settings.recipients,
    settings.includeClients ? await clientEmails(organizationId) : [],
  )
}

const dateKey = (date: Date) => date.toISOString().slice(0, 10)

type IssueRecord = Awaited<ReturnType<typeof findIssues>>[number]

function findIssues(organizationId: string) {
  return db.securityDigestIssue.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY,
    include: { deliveries: { orderBy: { email: 'asc' } } },
  })
}

function issueRowOf(issue: IssueRecord): IssueRow {
  return {
    id: issue.id,
    topic: issue.topic as DigestTopic,
    title: issue.title,
    preheader: issue.preheader,
    intro: issue.intro,
    tips: issue.tips,
    takeaway: issue.takeaway,
    status: issue.status as DigestStatus,
    sendOn: dateKey(issue.sendOn),
    error: issue.error,
    decidedByName: issue.decidedByName,
    decidedAt: issue.decidedAt?.toISOString() ?? null,
    sentAt: issue.sentAt?.toISOString() ?? null,
    createdAt: issue.createdAt.toISOString(),
    deliveries: issue.deliveries.map((delivery) => ({
      id: delivery.id,
      email: delivery.email,
      status: delivery.status as DeliveryStatus,
      at: delivery.createdAt.toISOString(),
    })),
  }
}

export async function overviewOf(
  organizationId: string,
  canManage: boolean,
): Promise<DigestOverview> {
  const [settings, clients, issues] = await Promise.all([
    settingsOf(organizationId),
    clientEmails(organizationId),
    findIssues(organizationId),
  ])
  return {
    settings,
    clientContacts: clients.length,
    issues: issues.map(issueRowOf),
    canManage,
    aiConfigured: isAiConfigured(),
    emailConfigured: isEmailConfigured(),
  }
}

/**
 * Writes next Monday's draft unless one is already waiting. A model failure is stored as a
 * failed issue, so the page shows IT what went wrong instead of the week going quiet.
 */
export async function draftIssueFor(organizationId: string, now = new Date()) {
  const today = workDateKey(now, await timeZoneOf(organizationId))
  const sendOn = new Date(`${nextSendOn(today)}T00:00:00.000Z`)

  const waiting = await db.securityDigestIssue.findFirst({
    where: { organizationId, sendOn, status: { in: ['draft', 'approved', 'sent'] } },
    select: { id: true },
  })
  if (waiting) return { id: waiting.id, created: false as const }

  const recent = await db.securityDigestIssue.findMany({
    where: { organizationId, title: { not: '' } },
    orderBy: { createdAt: 'desc' },
    take: RECENT_TITLES,
    select: { title: true, topic: true },
  })
  const topic = nextTopic(recent[0]?.topic)

  try {
    const draft = await generateIssue(
      topic,
      recent.map((issue) => issue.title),
    )
    const issue = await db.securityDigestIssue.create({
      data: {
        organizationId,
        topic,
        sendOn,
        ...draft.issue,
        model: draft.model,
        inputTokens: draft.inputTokens,
        outputTokens: draft.outputTokens,
      },
      select: { id: true },
    })
    return { id: issue.id, created: true as const }
  } catch (error) {
    const message =
      error instanceof DigestAiError ? error.message : 'The draft could not be written.'
    if (!(error instanceof DigestAiError)) console.error('[security-digest] draft failed', error)
    const issue = await db.securityDigestIssue.create({
      data: { organizationId, topic, sendOn, status: 'failed', error: message },
      select: { id: true },
    })
    return { id: issue.id, created: true as const }
  }
}

interface SendableIssue {
  topic: string
  title: string
  preheader: string
  intro: string[]
  tips: string[]
  takeaway: string
}

async function prepared(issue: SendableIssue, reportTo: string) {
  const topic = (DIGEST_TOPICS as readonly string[]).includes(issue.topic)
    ? (issue.topic as DigestTopic)
    : 'phishing'
  const hero = await digestGraphicBytes({ topic, title: issue.title })
  const email = securityDigestTemplate({
    ...issue,
    reportTo: reportTo || 'the IT department',
    hasHero: Boolean(hero),
  })
  const attachments = hero
    ? [
        {
          fileName: 'security-tip.png',
          contentType: 'image/png',
          content: hero,
          contentId: SECURITY_DIGEST_HERO_ID,
        },
      ]
    : []
  return { email, attachments }
}

function deliveryStatusOf(result: Awaited<ReturnType<typeof sendEmail>>): DeliveryStatus {
  if (result.delivered) return 'sent'
  return result.reason === 'not-configured' ? 'not_configured' : 'failed'
}

/** Sends one approved issue to everyone once; the status flip is the lock against a double send. */
export async function sendIssue(issueId: string, now = new Date()) {
  const claimed = await db.securityDigestIssue.updateMany({
    where: { id: issueId, status: 'approved' },
    data: { status: 'sent', sentAt: now },
  })
  if (claimed.count === 0) return { claimed: false as const, sent: 0, failed: 0 }

  const issue = await db.securityDigestIssue.findUniqueOrThrow({ where: { id: issueId } })
  const settings = await settingsOf(issue.organizationId)
  const recipients = await recipientsFor(issue.organizationId, settings)
  if (recipients.length === 0) {
    await db.securityDigestIssue.update({
      where: { id: issueId },
      data: { status: 'failed', sentAt: null, error: NO_RECIPIENTS },
    })
    return { claimed: true as const, sent: 0, failed: 0 }
  }

  const { email, attachments } = await prepared(issue, settings.reportTo)
  const deliveries: { issueId: string; email: string; status: DeliveryStatus }[] = []
  // One at a time: SES rate limits are per second, and a weekly list is short.
  for (const to of recipients) {
    deliveries.push({
      issueId,
      email: to,
      status: deliveryStatusOf(await sendEmail({ to, ...email, attachments })),
    })
  }
  await db.securityDigestDelivery.createMany({ data: deliveries })

  const sent = deliveries.filter((delivery) => delivery.status === 'sent').length
  if (sent === 0) {
    await db.securityDigestIssue.update({
      where: { id: issueId },
      data: { status: 'failed', error: 'No address accepted the email — check the email setup.' },
    })
  }
  return { claimed: true as const, sent, failed: deliveries.length - sent }
}

/** A one-off copy to whoever asked, outside the delivery log, so a preview never counts as sent. */
export async function sendTestCopy(issueId: string, organizationId: string, to: string) {
  const issue = await db.securityDigestIssue.findFirst({ where: { id: issueId, organizationId } })
  if (!issue || !issue.title) return undefined
  const settings = await settingsOf(organizationId)
  const { email, attachments } = await prepared(issue, settings.reportTo)
  return sendEmail({ to, ...email, subject: `[Test] ${email.subject}`, attachments })
}

export const DIGEST_STEPS = ['draft', 'send'] as const
export type DigestStep = (typeof DIGEST_STEPS)[number]

export interface DigestRunSummary {
  organizations: number
  drafted: number
  issues: number
  emailed: number
}

export async function runDigest(step: DigestStep, now = new Date()): Promise<DigestRunSummary> {
  const summary: DigestRunSummary = { organizations: 0, drafted: 0, issues: 0, emailed: 0 }

  if (step === 'draft') {
    const enabled = await db.securityDigestSettings.findMany({
      where: { enabled: true },
      select: { organizationId: true },
    })
    for (const { organizationId } of enabled) {
      summary.organizations += 1
      const result = await draftIssueFor(organizationId, now)
      if (result.created) summary.drafted += 1
    }
    return summary
  }

  // Approved issues whose day has come anywhere on earth; each is then checked in its own zone.
  const approved = await db.securityDigestIssue.findMany({
    where: { status: 'approved', sendOn: { lte: new Date(now.getTime() + 86_400_000) } },
    select: { id: true, organizationId: true, sendOn: true },
  })
  const enabled = new Set(
    (
      await db.securityDigestSettings.findMany({
        where: { enabled: true },
        select: { organizationId: true },
      })
    ).map((row) => row.organizationId),
  )
  for (const issue of approved) {
    if (!enabled.has(issue.organizationId)) continue
    const today = workDateKey(now, await timeZoneOf(issue.organizationId))
    if (dateKey(issue.sendOn) > today) continue
    summary.issues += 1
    try {
      summary.emailed += (await sendIssue(issue.id, now)).sent
    } catch (error) {
      console.error('[security-digest] send failed', error)
    }
  }
  return summary
}
