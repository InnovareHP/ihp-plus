import type { EventName } from '@/lib/analytics'

// feature.object.action, defined once so no call site inlines a string literal.
export const onboardingEvents = {
  started: 'onboarding.profile.started',
  stepCompleted: 'onboarding.profile.step_completed',
  completed: 'onboarding.profile.completed',
  failed: 'onboarding.profile.failed',
} as const satisfies Record<string, EventName>
