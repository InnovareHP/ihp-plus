import type { EventName } from '@/lib/analytics'

export const settingsEvents = {
  contactDetailsSaved: 'settings.contact_details.saved',
  contactDetailsSaveFailed: 'settings.contact_details.save_failed',
} as const satisfies Record<string, EventName>
