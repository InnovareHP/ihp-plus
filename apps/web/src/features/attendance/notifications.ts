import { db } from '@ihp/db'
import { correctionDecidedTemplate, portalUrl, sendEmail } from '@/lib/email'
import { routes } from '@/lib/routes'

export interface DecidedCorrection {
  userId: string
  workDate: string
  decision: 'approved' | 'rejected'
  deciderName: string
  note: string | undefined
}

/** Tells a member how their correction request went. Never throws: the decision is saved. */
export async function notifyCorrectionDecided(correction: DecidedCorrection) {
  try {
    const person = await db.user.findUnique({
      where: { id: correction.userId },
      select: { email: true },
    })
    if (!person) return

    void sendEmail({
      to: person.email,
      ...correctionDecidedTemplate({
        workDate: correction.workDate,
        decision: correction.decision,
        deciderName: correction.deciderName,
        note: correction.note,
        url: portalUrl(routes.attendance),
      }),
    })
  } catch (error) {
    console.error(`[attendance] could not tell ${correction.userId} about their correction`, error)
  }
}
