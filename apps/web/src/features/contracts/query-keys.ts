import type { ContractQuery } from './schema'

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (query: ContractQuery) => [...contractKeys.lists(), query] as const,
  detail: (contractId: string) => [...contractKeys.all, 'detail', contractId] as const,
  invoices: (contractId: string) => [...contractKeys.all, 'invoices', contractId] as const,
  activity: (contractId: string) => [...contractKeys.all, 'activity', contractId] as const,
  catalogs: () => [...contractKeys.all, 'catalog'] as const,
  catalog: (includeArchived = false) =>
    [...contractKeys.all, 'catalog', includeArchived ? 'with-archived' : 'active'] as const,
  template: () => [...contractKeys.all, 'template'] as const,
}
