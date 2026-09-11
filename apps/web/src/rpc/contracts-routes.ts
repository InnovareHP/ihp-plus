import type { ServiceImpl } from '@ihp/rpc'
import type { ContractsService } from '@ihp/rpc/contracts'
import {
  createCatalogItem,
  createContract,
  loadCatalog,
  loadContract,
  loadContractsPage,
  loadContractTemplate,
  setContractStatus,
  updateContractTemplate,
} from '@/features/contracts/service'
import {
  catalogCategoryFromProto,
  catalogToProto,
  catalogUnitFromProto,
  contractToProto,
  cycleFromProto,
  detailToProto,
  queryFromProto,
  statusFromProto,
} from './contracts-codec'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const contracts: ServiceImpl<typeof ContractsService> = {
  listContracts: async (request) => {
    const page = await loadContractsPage(queryFromProto(request.query))
    return {
      rows: page.rows.map(contractToProto),
      pageInfo: { $typeName: 'ihp.contracts.v1.PageInfo', ...page.pageInfo },
    }
  },

  getContract: async (request) => ({
    contract: detailToProto(await loadContract(request.contractId)),
  }),

  createContract: async (request) => ({
    contract: detailToProto(
      await createContract({
        clientId: request.clientId,
        title: request.title,
        billingCycle: cycleFromProto(request.billingCycle),
        startDate: request.startDate,
        endDate: request.endDate,
        terms: request.terms,
        lines: request.lines.map((line) => ({
          catalogItemId: line.catalogItemId,
          name: line.name,
          description: line.description,
          unitPriceCents: line.unitPriceCents,
          quantity: line.quantity,
          unit: catalogUnitFromProto(line.unit),
        })),
      }),
    ),
  }),

  setContractStatus: async (request) => ({
    contract: detailToProto(
      await setContractStatus({
        contractId: request.contractId,
        status: statusFromProto(request.status),
      }),
    ),
  }),

  listCatalog: async () => ({ items: (await loadCatalog()).map(catalogToProto) }),

  getContractTemplate: async () => ({
    template: { $typeName: 'ihp.contracts.v1.ContractTemplate', ...(await loadContractTemplate()) },
  }),

  updateContractTemplate: async (request) => ({
    template: {
      $typeName: 'ihp.contracts.v1.ContractTemplate',
      ...(await updateContractTemplate({
        scopeTemplate: request.scopeTemplate,
        standardTerms: request.standardTerms,
      })),
    },
  }),

  createCatalogItem: async (request) => ({
    item: catalogToProto(
      await createCatalogItem({
        category: catalogCategoryFromProto(request.category),
        name: request.name,
        description: request.description,
        priceMinCents: request.priceMinCents,
        priceMaxCents: request.priceMaxCents,
        unit: catalogUnitFromProto(request.unit),
        percentOfSpend: request.percentOfSpend,
        defaultTerms: request.defaultTerms,
      }),
    ),
  }),
}
