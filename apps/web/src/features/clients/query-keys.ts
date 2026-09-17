import type { ClientQuery } from './schema'

export const clientKeys = {
  all: ['clients'] as const,
  // Every page and filter combination is its own key under this prefix.
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (query: ClientQuery) => [...clientKeys.lists(), query] as const,
  filterOptions: () => [...clientKeys.all, 'filter-options'] as const,
}
