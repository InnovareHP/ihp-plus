'use client'

import { ConnectError } from '@ihp/rpc'
import type { ActivityTimelineItem } from '@/components/activity-timeline'
import { browserClients } from '@/rpc/browser'
import {
  activityFromProto,
  catalogFromProto,
  categoryToProto,
  contractFromProto,
  cycleToProto,
  detailFromProto,
  invoiceFromProto,
  queryToProto,
  statusToProto,
  unitToProto,
} from '@/rpc/contracts-codec'
import type {
  CatalogItemRow,
  CatalogItemValues,
  ContractDetail,
  ContractDraftValues,
  ContractInvoiceRow,
  ContractQuery,
  ContractStatus,
  ContractsPage,
  ContractTemplateValues,
  ContractUpdateValues,
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

export async function updateContract(values: ContractUpdateValues): Promise<ContractDetail> {
  const response = await call(() =>
    browserClients.contracts.updateContract({
      contractId: values.contractId,
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

export async function getContractTemplate(): Promise<ContractTemplateValues> {
  const response = await call(() => browserClients.contracts.getContractTemplate({}))
  return {
    scopeTemplate: response.template?.scopeTemplate ?? '',
    standardTerms: response.template?.standardTerms ?? '',
  }
}

export async function updateContractTemplate(
  values: ContractTemplateValues,
): Promise<ContractTemplateValues> {
  const response = await call(() => browserClients.contracts.updateContractTemplate(values))
  return {
    scopeTemplate: response.template?.scopeTemplate ?? '',
    standardTerms: response.template?.standardTerms ?? '',
  }
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
      defaultTerms: values.defaultTerms,
    }),
  )
  if (!response.item) throw new Error('The server did not return the new service.')
  return catalogFromProto(response.item)
}

export async function listContractInvoices(contractId: string): Promise<ContractInvoiceRow[]> {
  const response = await call(() => browserClients.contracts.listContractInvoices({ contractId }))
  return response.invoices.map(invoiceFromProto)
}

export async function listContractActivity(contractId: string): Promise<ActivityTimelineItem[]> {
  const response = await call(() => browserClients.contracts.listContractActivity({ contractId }))
  return response.entries.map(activityFromProto)
}
