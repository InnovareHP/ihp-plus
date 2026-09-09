'use server'

import { db } from '@ihp/db'
import { requireSession } from '@/lib/auth-guard'
import { onboardingSchema } from './schema'

export type CompleteOnboardingResult = { ok: true } | { ok: false; message: string }

function nullIfBlank(value: string) {
  return value === '' ? null : value
}

function dateOrNull(value: string) {
  return value === '' ? null : new Date(`${value}T00:00:00.000Z`)
}

function fullName(first: string, middle: string, last: string) {
  return [first, middle === '' ? '' : `${middle.toUpperCase()}.`, last].filter(Boolean).join(' ')
}

// This parse is the trust boundary; the same schema on the client only shapes the UX.
export async function completeOnboarding(values: unknown): Promise<CompleteOnboardingResult> {
  const session = await requireSession()
  const parsed = onboardingSchema.safeParse(values)

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Some of those answers are not valid — check the fields and retry.',
    }
  }

  const profile = parsed.data

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: {
        name: fullName(profile.firstName, profile.middleInitial, profile.lastName),
        firstName: profile.firstName,
        lastName: profile.lastName,
        middleInitial: nullIfBlank(profile.middleInitial.toUpperCase()),
        preferredName: nullIfBlank(profile.preferredName),
        phone: nullIfBlank(profile.phone),
        dateOfBirth: dateOrNull(profile.dateOfBirth),
        jobTitle: profile.jobTitle,
        department: profile.department,
        employmentType: profile.employmentType,
        employeeId: nullIfBlank(profile.employeeId),
        startDate: dateOrNull(profile.startDate),
        onboardingCompletedAt: new Date(),
      },
    })
  } catch {
    return { ok: false, message: 'Could not save your profile — check your connection and retry.' }
  }

  return { ok: true }
}
