'use client'

import { ConnectError } from '@ihp/rpc'
import { browserClients } from '@/rpc/browser'
import {
  catalogFromProto,
  categoryToProto,
  contractFromProto,
  cycleToProto,
  detailFromProto,
  queryToProto,
  statusToProto,
  unitToProto,
} from '@/rpc/contracts-codec'
import type {
  CatalogItemRow,
  CatalogItemValues,
  ContractDetail,
  ContractDraftValues,
  ContractQuery,
  ContractStatus,
  ContractsPage,
} from './schema'

/**
 * ConnectError stringifies as "[permission_denied] …", putting a machine code in front of a
 * sentence a user reads. The code stays on the ConnectError for anything that branches on it;
 * what reaches the UI is the plain message.
 */
async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw new Error(ConnectError.from(error).rawMessage)
  }
}

export async function listContracts(query: ContractQuery): Promise<ContractsPage> {
  const response = await call(() =>
    browserClients.contracts.listContracts({ query: queryToProto(query) }),
  )
  const pageInfo = response.pageInfo
  if (!pageInfo) throw new Error('The server did not return page information.')

  return {
    rows: response.rows.map(contractFromProto),
    pageInfo: {
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
      total: pageInfo.total,
      pageCount: pageInfo.pageCount,
      hasPrevious: pageInfo.hasPrevious,
      hasNext: pageInfo.hasNext,
    },
  }
}

export async function getContract(contractId: string): Promise<ContractDetail> {
  const response = await call(() => browserClients.contracts.getContract({ contractId }))
  return detailFromProto(response.contract)
}

export async function createContract(values: ContractDraftValues): Promise<ContractDetail> {
  const response = await call(() =>
    browserClients.contracts.createContract({
      clientId: values.clientId,
      title: values.title,
      billingCycle: cycleToProto(values.billingCycle),
      startDate: values.startDate,
      endDate: values.endDate,
      terms: values.terms,
      lines: values.lines.map((line) => ({
        $typeName: 'ihp.contracts.v1.ContractDraftLine' as const,
        catalogItemId: line.catalogItemId,
        name: line.name,
        description: line.description,
        unitPriceCents: line.unitPriceCents,
        quantity: line.quantity,
        unit: unitToProto(line.unit),
      })),
    }),
  )
  return detailFromProto(response.contract)
}

export async function setContractStatus(values: {
  contractId: string
  status: ContractStatus
}): Promise<ContractDetail> {
  const response = await call(() =>
    browserClients.contracts.setContractStatus({
      contractId: values.contractId,
      status: statusToProto(values.status),
    }),
  )
  return detailFromProto(response.contract)
}

export async function listCatalog(): Promise<CatalogItemRow[]> {
  const response = await call(() => browserClients.contracts.listCatalog({}))
  return response.items.map(catalogFromProto)
}

export async function createCatalogItem(values: CatalogItemValues): Promise<CatalogItemRow> {
  const response = await call(() =>
    browserClients.contracts.createCatalogItem({
      category: categoryToProto(values.category),
      name: values.name,
      description: values.description,
      priceMinCents: values.priceMinCents,
      priceMaxCents: values.priceMaxCents,
      unit: unitToProto(values.unit),
      percentOfSpend: values.percentOfSpend,
    }),
  )
  if (!response.item) throw new Error('The server did not return the new service.')
  return catalogFromProto(response.item)
}
