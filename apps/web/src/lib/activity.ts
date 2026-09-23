import { db } from '@ihp/db'

/** Every action the history records, in the words a timeline shows. */
export const ACTIVITY_LABELS = {
  'contract.created': 'Drafted',
  'contract.edited': 'Draft edited',
  'contract.published': 'Published to the client',
  'contract.returned_to_draft': 'Returned to draft',
  'contract.viewed': 'Opened by the client',
  'contract.accepted': 'Accepted by the client',
  'contract.agreed': 'Marked as agreed',
  'contract.paused': 'Paused',
  'contract.resumed': 'Resumed',
  'contract.cancelled': 'Cancelled',
  'contract.completed': 'Marked complete',
  'request.submitted': 'Request raised',
  'request.approved': 'Approved',
  'request.rejected': 'Turned down',
  'request.withdrawn': 'Withdrawn',
  'request.cancelled': 'Leave cancelled',
  'evaluation.assigned': 'Evaluation assigned',
  'evaluation.submitted': 'Evaluation submitted',
  'evaluation.cancelled': 'Evaluation cancelled',
  'task.created': 'Task created',
  'task.completed': 'Task completed',
  'task.reopened': 'Task reopened',
  'task.deleted': 'Task deleted',
  'task.commented': 'Commented',
  'task.attached': 'File attached',
  'attendance.day.edited': 'Attendance corrected',
  'attendance.day.deleted': 'Attendance removed',
} as const

export type ActivityAction = keyof typeof ACTIVITY_LABELS

export type ActivitySubject = 'contract' | 'request' | 'evaluation' | 'task' | 'attendance'

export interface ActivityInput {
  organizationId: string
  subjectType: ActivitySubject
  subjectId: string
  action: ActivityAction
  /** Null when the actor is not a portal user, such as a client accepting through their link. */
  actorId: string | null
  actorName: string
  detail?: string | undefined
}

export interface ActivityItem {
  id: string
  label: string
  actorName: string
  detail: string | undefined
  createdAt: string
}

const MAX_DETAIL = 500

/** Appends one entry. Never throws: the change it records has already happened and must stand. */
export async function recordActivity(input: ActivityInput) {
  try {
    await db.activityEvent.create({
      data: {
        organizationId: input.organizationId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        action: input.action,
        actorId: input.actorId,
        actorName: input.actorName,
        detail: input.detail ? input.detail.slice(0, MAX_DETAIL) : null,
      },
    })
  } catch (error) {
    console.error(
      `[activity] could not record ${input.action} on ${input.subjectType} ${input.subjectId}`,
      error,
    )
  }
}

function labelOf(action: string) {
  return action in ACTIVITY_LABELS ? ACTIVITY_LABELS[action as ActivityAction] : action
}

/** One subject's history, oldest first. The caller has already checked the subject is readable. */
export async function loadActivity(
  organizationId: string,
  subjectType: ActivitySubject,
  subjectId: string,
): Promise<ActivityItem[]> {
  const rows = await db.activityEvent.findMany({
    where: { organizationId, subjectType, subjectId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { id: true, action: true, actorName: true, detail: true, createdAt: true },
  })

  return rows.map((row) => ({
    id: row.id,
    label: labelOf(row.action),
    actorName: row.actorName,
    detail: row.detail ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }))
}
