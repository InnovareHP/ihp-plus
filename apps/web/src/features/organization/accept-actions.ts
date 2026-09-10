'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { requireSession } from '@/lib/auth-guard'
import { invitationIdSchema } from './schema'
import type { MutateResult } from './actions'

// Invitee-facing, so these deliberately carry no manager guard — Better Auth checks that the
// signed-in address matches the invitation itself.
export async function acceptInvitation(input: unknown): Promise<MutateResult> {
  await requireSession()

  const parsed = invitationIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That invitation link is not valid.' }

  try {
    await auth.api.acceptInvitation({
      body: { invitationId: parsed.data.invitationId },
      headers: await headers(),
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not accept that invitation — try again.'
    return { ok: false, message }
  }

  return { ok: true }
}

export async function rejectInvitation(input: unknown): Promise<MutateResult> {
  await requireSession()

  const parsed = invitationIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That invitation link is not valid.' }

  try {
    await auth.api.rejectInvitation({
      body: { invitationId: parsed.data.invitationId },
      headers: await headers(),
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not decline that invitation — try again.'
    return { ok: false, message }
  }

  return { ok: true }
}
