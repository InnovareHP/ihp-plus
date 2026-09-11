import type { ContractQuery } from './schema'

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (query: ContractQuery) => [...contractKeys.lists(), query] as const,
  detail: (contractId: string) => [...contractKeys.all, 'detail', contractId] as const,
  catalog: () => [...contractKeys.all, 'catalog'] as const,
  template: () => [...contractKeys.all, 'template'] as const,
}
