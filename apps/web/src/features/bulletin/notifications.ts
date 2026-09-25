import { db } from '@ihp/db'
import { bulletinMentionTemplate, portalUrl, sendEmail } from '@/lib/email'
import { bulletinPostRoute } from '@/lib/routes'

export interface BulletinMentionNotice {
  postId: string
  authorName: string
  inReply: boolean
  body: string
  /** Already checked against the organization by the caller. */
  userIds: readonly string[]
}

// An email quotes the words rather than repeating them in full: the board is where they are read.
const EXCERPT_LIMIT = 280

export function excerptOf(body: string) {
  const flattened = body.replace(/\s+/g, ' ').trim()
  return flattened.length > EXCERPT_LIMIT ? `${flattened.slice(0, EXCERPT_LIMIT - 1)}…` : flattened
}

/** Never throws: the post is saved before this runs, and a mail hiccup must not fail it. */
export async function notifyMentions(notice: BulletinMentionNotice) {
  if (notice.userIds.length === 0) return

  try {
    const people = await db.user.findMany({
      where: { id: { in: [...notice.userIds] } },
      select: { email: true },
    })

    const message = bulletinMentionTemplate({
      authorName: notice.authorName,
      inReply: notice.inReply,
      excerpt: excerptOf(notice.body),
      url: portalUrl(bulletinPostRoute(notice.postId)),
    })

    await Promise.all(people.map((person) => sendEmail({ to: person.email, ...message })))
  } catch {
    // Reported by the mail transport's own logging; the post is already stored.
  }
}
