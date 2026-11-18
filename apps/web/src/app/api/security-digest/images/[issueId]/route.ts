import { db } from '@ihp/db'
import { NextResponse } from 'next/server'
import { digestGraphic } from '@/features/security-digest/graphic'
import { DIGEST_TOPICS, type DigestTopic } from '@/features/security-digest/schema'
import { websitesAccess } from '@/features/websites/access'

// Gated per viewer, so nothing between the browser and Next may cache it for everyone.
export const dynamic = 'force-dynamic'

/** The header picture as IT sees it on the page; recipients get the same bytes inline. */
export async function GET(_request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params
  const access = await websitesAccess()
  if (!access.canView || !access.organizationId) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const issue = await db.securityDigestIssue.findFirst({
    where: { id: issueId, organizationId: access.organizationId },
    select: { topic: true, title: true },
  })
  if (!issue?.title || !(DIGEST_TOPICS as readonly string[]).includes(issue.topic)) {
    return NextResponse.json({ error: 'That issue has no picture.' }, { status: 404 })
  }

  const image = await digestGraphic({ topic: issue.topic as DigestTopic, title: issue.title })
  image.headers.set('Cache-Control', 'private, max-age=3600')
  return image
}
