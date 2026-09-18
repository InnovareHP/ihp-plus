import { db } from '@ihp/db'
import {
  evaluationAssignedTemplate,
  evaluationCancelledTemplate,
  evaluationSubmittedTemplate,
  portalUrl,
  sendEmail,
} from '@/lib/email'
import { evaluationRoute, routes } from '@/lib/routes'

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
  assignedById: string | null
  evaluatorId: string
  evaluatorName: string
  employeeId: string
  formName: string
}

export interface CancelledEvaluation {
  evaluatorId: string
  employeeId: string
  formName: string
  cancelledByName: string
}

/**
 * Tells whoever asked for the evaluation that it came back. Skipped when they cancelled it
 * themselves — they are already looking at the answer. Never throws: the row is already saved.
 */
export async function notifyAssigner(evaluation: SubmittedEvaluation) {
  try {
    if (!evaluation.assignedById || evaluation.assignedById === evaluation.evaluatorId) return

    const [assigner, employee] = await Promise.all([
      db.user.findUnique({ where: { id: evaluation.assignedById }, select: { email: true } }),
      nameOf(evaluation.employeeId),
    ])
    if (!assigner) return

    void sendEmail({
      to: assigner.email,
      ...evaluationSubmittedTemplate({
        evaluatorName: evaluation.evaluatorName,
        employeeName: employee,
        formName: evaluation.formName,
        url: portalUrl(evaluationRoute(evaluation.evaluationId)),
      }),
    })
  } catch (error) {
    console.error(`[evaluations] could not report ${evaluation.evaluationId} back`, error)
  }
}

/** Tells the evaluator to stop: a cancelled evaluation keeps nothing they typed. */
export async function notifyEvaluatorCancelled(evaluation: CancelledEvaluation) {
  try {
    const [evaluator, employee] = await Promise.all([
      db.user.findUnique({ where: { id: evaluation.evaluatorId }, select: { email: true } }),
      nameOf(evaluation.employeeId),
    ])
    if (!evaluator) return

    void sendEmail({
      to: evaluator.email,
      ...evaluationCancelledTemplate({
        formName: evaluation.formName,
        employeeName: employee,
        cancelledByName: evaluation.cancelledByName,
        url: portalUrl(routes.evaluations),
      }),
    })
  } catch (error) {
    console.error(`[evaluations] could not tell ${evaluation.evaluatorId} it was cancelled`, error)
  }
}

async function nameOf(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, preferredName: true },
  })
  return user?.preferredName ?? user?.name ?? 'a colleague'
}
