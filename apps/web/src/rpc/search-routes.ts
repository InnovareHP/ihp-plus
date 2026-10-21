import type { ServiceImpl } from '@ihp/rpc'
import { SearchService } from '@ihp/rpc/search'
import { loadSearchDirectory, searchTasks } from '@/features/search/service'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const search: ServiceImpl<typeof SearchService> = {
  getDirectory: async () => {
    const directory = await loadSearchDirectory()
    return {
      people: directory.people.map((person) => ({
        $typeName: 'ihp.search.v1.PersonHit' as const,
        ...person,
      })),
      clients: directory.clients.map((client) => ({
        $typeName: 'ihp.search.v1.ClientHit' as const,
        ...client,
      })),
    }
  },

  searchTasks: async (request) => ({
    tasks: (await searchTasks({ query: request.query, limit: request.limit })).map((task) => ({
      $typeName: 'ihp.search.v1.TaskHit' as const,
      ...task,
    })),
  }),
}
