import type { BluebookQuery } from './schema'

export const bluebookKeys = {
  all: ['bluebook'] as const,
  lists: () => [...bluebookKeys.all, 'list'] as const,
  list: (query: BluebookQuery) => [...bluebookKeys.lists(), query] as const,
  options: () => [...bluebookKeys.all, 'options'] as const,
  leads: () => [...bluebookKeys.all, 'leads'] as const,
}
