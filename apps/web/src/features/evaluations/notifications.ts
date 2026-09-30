import { db } from '@ihp/db'
import {
  evaluationAssignedTemplate,
  evaluationCancelledTemplate,
  evaluationSubmittedTemplate,
  portalUrl,
  sendEmail,
} from '@/lib/email'
import { evaluationRoute, routes } from '@/lib/routes'
import { executiveUserIds } from './executives'

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

export interface SubmittedEvaluation {
  evaluationId: string
  organizationId: string
  evaluatorId: string
  employeeId: string
  formName: string
}

export interface CancelledEvaluation {
  evaluatorId: string
  formName: string
}

/**
 * Sends a finished evaluation to the Executive department only. Never the person evaluated, even
 * when they sit in that department, and never the evaluator, who wrote it. Never throws: the
 * answers are already saved.
 */
export async function notifyExecutives(evaluation: SubmittedEvaluation) {
  try {
    const recipients = (await executiveUserIds(evaluation.organizationId)).filter(
      (userId) => userId !== evaluation.employeeId && userId !== evaluation.evaluatorId,
    )
    if (recipients.length === 0) {
      console.warn(
        `[evaluations] ${evaluation.evaluationId} was submitted but no one in the Executive department can be told`,
      )
      return
    }

    const people = await db.user.findMany({
      where: { id: { in: recipients } },
      select: { email: true },
    })

    const message = evaluationSubmittedTemplate({
      formName: evaluation.formName,
      url: portalUrl(evaluationRoute(evaluation.evaluationId)),
    })

    // One message per person, so executives never see each other's addresses.
    for (const person of people) {
      void sendEmail({ to: person.email, ...message })
    }
  } catch (error) {
    console.error(`[evaluations] could not report ${evaluation.evaluationId} back`, error)
  }
}

/** Tells the evaluator to stop: a cancelled evaluation keeps nothing they typed. */
export async function notifyEvaluatorCancelled(evaluation: CancelledEvaluation) {
  try {
    const evaluator = await db.user.findUnique({
      where: { id: evaluation.evaluatorId },
      select: { email: true },
    })
    if (!evaluator) return

    void sendEmail({
      to: evaluator.email,
      ...evaluationCancelledTemplate({
        formName: evaluation.formName,
        url: portalUrl(routes.evaluations),
      }),
    })
  } catch (error) {
    console.error(`[evaluations] could not tell ${evaluation.evaluatorId} it was cancelled`, error)
  }
}
