import { db } from '@ihp/db'
import { evaluationAssignedTemplate, portalUrl, sendEmail } from '@/lib/email'
import { routes } from '@/lib/routes'

export interface AssignedEvaluations {
  evaluatorId: string
  formName: string
  count: number
  dueAt: Date | null
}

/**
 * Emails the supervisor once for the whole batch: twenty separate mails about the same form
 * would be twenty reasons to ignore the next one. Never throws — the rows are already saved.
 */
export async function notifyEvaluator(assignment: AssignedEvaluations) {
  try {
    const evaluator = await db.user.findUnique({
      where: { id: assignment.evaluatorId },
      select: { email: true },
    })
    if (!evaluator) return

    void sendEmail({
      to: evaluator.email,
      ...evaluationAssignedTemplate({
        formName: assignment.formName,
        count: assignment.count,
        dueAt: assignment.dueAt,
        url: portalUrl(routes.evaluations),
      }),
    })
  } catch (error) {
    console.error(`[evaluations] could not notify ${assignment.evaluatorId}`, error)
  }
}
