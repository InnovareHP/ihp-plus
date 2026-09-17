import type { MemberQuery } from './schema'

export const memberKeys = {
  all: ['members'] as const,
  // Every page/filter combination is its own key under this prefix, so one patch can hit them all.
  lists: () => [...memberKeys.all, 'list'] as const,
  list: (query: MemberQuery) => [...memberKeys.lists(), query] as const,
  filterOptions: () => [...memberKeys.all, 'filter-options'] as const,
}
