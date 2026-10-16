import type { EventName } from '@/lib/analytics'

// The query text is never sent: it can hold a person's or a client's name.
export const searchEvents = {
  paletteOpened: 'search.palette.opened',
  resultOpened: 'search.result.opened',
} as const satisfies Record<string, EventName>
