import type { OnboardingValues } from '../schema'

// The photo preview cannot be rebuilt from a key after a refresh, and confirming is asked afresh.
export const DRAFT_FIELDS = [
  'firstName',
  'middleInitial',
  'lastName',
  'preferredName',
  'phone',
  'dateOfBirth',
  'jobTitle',
  'teamId',
  'employmentType',
  'startDate',
] as const satisfies readonly (keyof OnboardingValues)[]

export type OnboardingDraft = Partial<Pick<OnboardingValues, (typeof DRAFT_FIELDS)[number]>>

// Keyed per account so a shared browser never offers one person's answers to the next.
export function draftKey(userId: string) {
  return `ihp:onboarding-draft:${userId}`
}

export function pickDraft(values: Partial<OnboardingValues>): OnboardingDraft {
  const draft: OnboardingDraft = {}
  for (const field of DRAFT_FIELDS) {
    const value = values[field]
    if (typeof value === 'string') draft[field] = value
  }
  return draft
}

// Storage can throw (private mode, blocked site data) or hold anything, so every read is defensive.
export function readDraft(userId: string): OnboardingDraft {
  try {
    const raw = window.localStorage.getItem(draftKey(userId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? pickDraft(parsed as Partial<OnboardingValues>)
      : {}
  } catch {
    return {}
  }
}

export function writeDraft(userId: string, values: Partial<OnboardingValues>) {
  try {
    window.localStorage.setItem(draftKey(userId), JSON.stringify(pickDraft(values)))
  } catch {
    // A full or blocked storage only costs the refresh safety net, never the form itself.
  }
}

export function clearDraft(userId: string) {
  try {
    window.localStorage.removeItem(draftKey(userId))
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
