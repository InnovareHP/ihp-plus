'use server'

import { db } from '@ihp/db'
import { unstable_rethrow } from 'next/navigation'
import { websitesAccess } from '@/features/websites/access'
import { requireOnboarded } from '@/lib/auth-guard'
import {
  issueIdSchema,
  settingsSchema,
  type DigestOverview,
  type IssueIdValues,
  type SettingsValues,
} from './schema'
import {
  draftIssueFor,
  NO_RECIPIENTS,
  overviewOf,
  saveSettings,
  sendIssue,
  sendTestCopy,
} from './service'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }

const NOT_FOUND = 'This page is only for the IT department.'
const NOT_MANAGER = 'Only the IT lead or an admin can change the security emails.'
const INVALID = 'Check the highlighted fields and try again.'
const GONE = 'That issue is no longer waiting for this — refresh the page.'

const BROKEN =
  'The security emails could not be reached — the database may need its latest migration. Try again shortly.'

// Production React hides a thrown action's message behind an error code, so failures come back as text.
async function safely<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await run()
  } catch (error) {
    unstable_rethrow(error)
    console.error('[security-digest] action failed', error)
    return { ok: false, message: BROKEN }
  }
}

async function caller(needsManage: boolean) {
  const access = await websitesAccess()
  if (!access.canView || !access.organizationId) return { ok: false as const, message: NOT_FOUND }
  if (needsManage && !access.canManage) return { ok: false as const, message: NOT_MANAGER }
  return { ok: true as const, access: { ...access, organizationId: access.organizationId } }
}

export async function getDigestOverview(): Promise<Result<DigestOverview>> {
  return safely(async () => {
    const who = await caller(false)
    if (!who.ok) return who
    return { ok: true, data: await overviewOf(who.access.organizationId, who.access.canManage) }
  })
}

export async function saveDigestSettings(values: SettingsValues): Promise<Result<SettingsValues>> {
  return safely(async () => {
    const who = await caller(true)
    if (!who.ok) return who
    const parsed = settingsSchema.safeParse(values)
    if (!parsed.success) return { ok: false, message: INVALID }
    await saveSettings(who.access.organizationId, parsed.data)
    return { ok: true, data: parsed.data }
  })
}

export async function generateDigestDraft(): Promise<
  Result<{ issueId: string; created: boolean }>
> {
  return safely(async () => {
    const who = await caller(true)
    if (!who.ok) return who
    const result = await draftIssueFor(who.access.organizationId)
    return { ok: true, data: { issueId: result.id, created: result.created } }
  })
}

async function decide(
  values: IssueIdValues,
  from: string[],
  to: 'approved' | 'rejected',
): Promise<Result<{ issueId: string }>> {
  const who = await caller(true)
  if (!who.ok) return who
  const parsed = issueIdSchema.safeParse(values)
  if (!parsed.success) return { ok: false, message: GONE }
  // Scoped by organization and current status, so a stale tab or another org's id changes nothing.
  const changed = await db.securityDigestIssue.updateMany({
    where: {
      id: parsed.data.issueId,
      organizationId: who.access.organizationId,
      status: { in: from },
    },
    data: {
      status: to,
      decidedById: who.access.userId,
      decidedByName: who.access.userName,
      decidedAt: new Date(),
    },
  })
  if (changed.count === 0) return { ok: false, message: GONE }
  return { ok: true, data: { issueId: parsed.data.issueId } }
}

export async function approveDigestIssue(values: IssueIdValues) {
  return safely(() => decide(values, ['draft'], 'approved'))
}

export async function rejectDigestIssue(values: IssueIdValues) {
  return safely(() => decide(values, ['draft', 'approved'], 'rejected'))
}

export async function sendDigestIssueNow(
  values: IssueIdValues,
): Promise<Result<{ sent: number; failed: number }>> {
  return safely(async () => {
    const who = await caller(true)
    if (!who.ok) return who
    const parsed = issueIdSchema.safeParse(values)
    if (!parsed.success) return { ok: false, message: GONE }
    const issue = await db.securityDigestIssue.findFirst({
      where: { id: parsed.data.issueId, organizationId: who.access.organizationId },
      select: { id: true, status: true },
    })
    if (!issue) return { ok: false, message: GONE }
    // Sending a draft straight away is IT approving it, so the record says who did.
    if (issue.status === 'draft') {
      await db.securityDigestIssue.updateMany({
        where: { id: issue.id, status: 'draft' },
        data: {
          status: 'approved',
          decidedById: who.access.userId,
          decidedByName: who.access.userName,
          decidedAt: new Date(),
        },
      })
    }
    const result = await sendIssue(issue.id)
    if (!result.claimed) return { ok: false, message: GONE }
    if (result.sent + result.failed === 0) return { ok: false, message: NO_RECIPIENTS }
    return { ok: true, data: { sent: result.sent, failed: result.failed } }
  })
}

export async function sendDigestTest(values: IssueIdValues): Promise<Result<{ to: string }>> {
  return safely(async () => {
    const who = await caller(true)
    if (!who.ok) return who
    const parsed = issueIdSchema.safeParse(values)
    if (!parsed.success) return { ok: false, message: GONE }
    const { user } = await requireOnboarded()
    const sent = await sendTestCopy(parsed.data.issueId, who.access.organizationId, user.email)
    if (!sent) return { ok: false, message: 'That issue has no content to send.' }
    if (!sent.delivered) {
      return {
        ok: false,
        message:
          sent.reason === 'not-configured'
            ? 'Email is not set up on this server, so the test was only logged.'
            : 'The test email could not be sent — try again in a moment.',
      }
    }
    return { ok: true, data: { to: user.email } }
  })
}
