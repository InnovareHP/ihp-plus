'use client'

import { useMutation } from '@tanstack/react-query'
import { completeOnboarding } from './actions'
import type { OnboardingValues } from './schema'

// Not optimistic: nothing in the cache holds this profile yet, and success navigates away.
export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async (values: OnboardingValues) => {
      const result = await completeOnboarding(values)
      if (!result.ok) throw new Error(result.message)
      return result
    },
  })
}
