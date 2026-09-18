import { db } from '@ihp/db'
import { portalUrl, sendEmail, taskCommentTemplate, taskMentionTemplate } from '@/lib/email'
import { routes } from '@/lib/routes'

export interface CommentedTask {
  taskId: string
  taskNumber: number
  taskName: string
  projectId: string
  authorId: string
  authorName: string
  body: string
  /** Already checked against the organization by the caller. */
  mentionedIds: readonly string[]
}

// An email quotes the comment rather than repeating it in full: the task is where it is read.
const EXCERPT_LIMIT = 280

function excerptOf(body: string) {
  const flattened = body.replace(/\s+/g, ' ').trim()
  return flattened.length > EXCERPT_LIMIT ? `${flattened.slice(0, EXCERPT_LIMIT - 1)}…` : flattened
}

/**
 * Two audiences, one pass: whoever was named gets the mention, and everyone else already on the
 * task gets the quieter one. Never throws — the comment is saved before this runs, and a mail
 * provider having a bad minute must not fail the post.
 */
export async function notifyComment(task: CommentedTask) {
  try {
    const url = portalUrl(`${routes.tasks}?project=${task.projectId}&task=${task.taskId}`)
    const excerpt = excerptOf(task.body)

    const mentioned = [...new Set(task.mentionedIds)].filter((id) => id !== task.authorId)
    const following = (await followerIds(task.taskId)).filter(
      (id) => id !== task.authorId && !mentioned.includes(id),
    )

    await Promise.all([
      deliver(mentioned, () =>
        taskMentionTemplate({
          authorName: task.authorName,
          taskNumber: task.taskNumber,
          taskName: task.taskName,
          excerpt,
          url,
        }),
      ),
      deliver(following, () =>
        taskCommentTemplate({
          authorName: task.authorName,
          taskNumber: task.taskNumber,
          taskName: task.taskName,
          excerpt,
          url,
        }),
      ),
    ])
  } catch {
    // Reported by the mail transport's own logging; the comment is already stored.
  }
}

/** Who the conversation reaches: the people doing the task, plus anyone who has replied on it. */
async function followerIds(taskId: string) {
  const [assignees, commenters] = await Promise.all([
    db.taskAssignee.findMany({ where: { taskId }, select: { userId: true } }),
    db.taskComment.findMany({
      where: { taskId },
      select: { authorId: true },
      distinct: ['authorId'],
    }),
  ])

  return [
    ...new Set([...assignees.map((row) => row.userId), ...commenters.map((row) => row.authorId)]),
  ]
}

async function deliver(
  userIds: readonly string[],
  template: () => ReturnType<typeof taskMentionTemplate>,
) {
  if (userIds.length === 0) return

  const people = await db.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { email: true },
  })
  if (people.length === 0) return

  const message = template()
  await Promise.all(people.map((person) => sendEmail({ to: person.email, ...message })))
}
