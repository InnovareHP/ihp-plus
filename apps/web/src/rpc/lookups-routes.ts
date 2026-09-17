import type { ServiceImpl } from '@ihp/rpc'
import { LookupsService } from '@ihp/rpc/lookups'
import { loadOptions } from '@/features/lookups/service'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const lookups: ServiceImpl<typeof LookupsService> = {
  listOptions: async (request) => ({
    options: (await loadOptions(request.kind)).map((option) => ({
      $typeName: 'ihp.lookups.v1.LookupOption' as const,
      value: option.value,
      sortOrder: option.sortOrder,
    })),
  }),
}
