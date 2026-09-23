'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure, announceSuccess } from '@/lib/announce'
import { useOptimisticListMutation } from '@/lib/optimistic'
import { contractEvents } from './events'
import { contractKeys } from './query-keys'
import {
  createCatalogItem,
  setCatalogItemArchived,
  updateCatalogItem,
  createContract,
  getContract,
  getContractTemplate,
  listCatalog,
  listContractActivity,
  listContractInvoices,
  listContracts,
  setContractStatus,
  updateContract,
  updateContractTemplate,
} from './rpc'
import type {
  CatalogItemRow,
  CatalogItemValues,
  ContractDraftValues,
  ContractQuery,
  ContractStatus,
  ContractTemplateValues,
  ContractUpdateValues,
} from './schema'

export function useContracts(query: ContractQuery) {
  return useQuery({
    queryKey: contractKeys.list(query),
    queryFn: () => listContracts(query),
    // Paging or refiltering keeps the previous page on screen instead of blanking the table.
    placeholderData: keepPreviousData,
  })
}

export function useContract(contractId: string) {
  return useQuery({
    queryKey: contractKeys.detail(contractId),
    queryFn: () => getContract(contractId),
    enabled: contractId !== '',
  })
}

/** The active card for pricing a contract; a manager's rate card also asks for the archived. */
export function useCatalog(includeArchived = false) {
  return useQuery({
    queryKey: contractKeys.catalog(includeArchived),
    queryFn: () => listCatalog(includeArchived),
    // The rate card changes far less often than the contracts priced from it.
    staleTime: 5 * 60 * 1000,
  })
}

export function useContractTemplate() {
  return useQuery({
    queryKey: contractKeys.template(),
    queryFn: getContractTemplate,
    // Boilerplate changes far less often than the contracts built from it.
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateContractTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: ContractTemplateValues) => updateContractTemplate(values),
    onSuccess: (template) => {
      track(contractEvents.templateSaved)
      queryClient.setQueryData(contractKeys.template(), template)
      announceSuccess('Standard terms saved.')
    },
    onError: (error: Error) => {
      track(contractEvents.templateSaveFailed, { reason: error.message })
      announceFailure(error.message)
    },
  })
}

export function useCreateContract() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: ContractDraftValues) => createContract(values),
    onSuccess: (contract) => {
      track(contractEvents.created)
      announceSuccess(`Contract ${contract.reference} created.`)
    },
    onError: (error: Error) => {
      track(contractEvents.createFailed, { reason: error.message })
      announceFailure(error.message)
    },
    // Not optimistic: the server assigns the reference and the subtotal, so there is nothing
    // truthful to show until it answers.
    onSettled: () => queryClient.invalidateQueries({ queryKey: contractKeys.lists() }),
  })
}

export function useUpdateContract() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: ContractUpdateValues) => updateContract(values),
    onSuccess: (contract) => {
      track(contractEvents.updated)
      queryClient.setQueryData(contractKeys.detail(contract.id), contract)
      announceSuccess(`Contract ${contract.reference} saved.`)
    },
    onError: (error: Error) => {
      track(contractEvents.updateFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: (_data, _error, values) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() })
      queryClient.invalidateQueries({ queryKey: contractKeys.activity(values.contractId) })
    },
  })
}

export function useSetContractStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: { contractId: string; status: ContractStatus }) =>
      setContractStatus(values),
    onSuccess: (contract) => {
      track(contractEvents.statusChanged)
      // The server owns signedAt, so the detail it returns replaces the cached copy.
      queryClient.setQueryData(contractKeys.detail(contract.id), contract)
    },
    onError: (error: Error) => {
      track(contractEvents.statusChangeFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: (_data, _error, values) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() })
      queryClient.invalidateQueries({ queryKey: contractKeys.activity(values.contractId) })
    },
  })
}

export function useCreateCatalogItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: CatalogItemValues) => createCatalogItem(values),
    onSuccess: (item) => {
      track(contractEvents.catalogItemAdded)
      announceSuccess(`${item.name} added to the rate card.`)
    },
    onError: (error: Error) => {
      track(contractEvents.catalogItemAddFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: contractKeys.catalogs() }),
  })
}

export function useContractInvoices(contractId: string, enabled: boolean) {
  return useQuery({
    queryKey: contractKeys.invoices(contractId),
    queryFn: () => listContractInvoices(contractId),
    enabled,
    // Invoices change on Stripe's schedule, not while someone is reading the drawer.
    staleTime: 60 * 1000,
  })
}

export function useContractActivity(contractId: string) {
  return useQuery({
    queryKey: contractKeys.activity(contractId),
    queryFn: () => listContractActivity(contractId),
  })
}

export function useUpdateCatalogItem() {
  return useOptimisticListMutation<CatalogItemRow, { itemId: string; values: CatalogItemValues }>({
    // The manager's card holds the archived too, so it is the list the edit is applied to.
    queryKey: contractKeys.catalog(true),
    mutationFn: async ({ itemId, values }) => {
      await updateCatalogItem(itemId, values)
    },
    apply: (rows, { itemId, values }) =>
      rows.map((row) =>
        row.id === itemId
          ? {
              ...row,
              ...values,
              description: values.description || undefined,
              defaultTerms: values.defaultTerms || undefined,
            }
          : row,
      ),
    successEvent: contractEvents.catalogItemEdited,
    failureEvent: contractEvents.catalogItemEditFailed,
    alsoInvalidate: [contractKeys.catalog(false)],
  })
}

export function useSetCatalogItemArchived() {
  return useOptimisticListMutation<CatalogItemRow, { itemId: string; archived: boolean }>({
    queryKey: contractKeys.catalog(true),
    mutationFn: async ({ itemId, archived }) => {
      await setCatalogItemArchived(itemId, archived)
    },
    apply: (rows, { itemId, archived }) =>
      rows.map((row) => (row.id === itemId ? { ...row, archived } : row)),
    successEvent: contractEvents.catalogItemArchived,
    failureEvent: contractEvents.catalogItemArchiveFailed,
    alsoInvalidate: [contractKeys.catalog(false)],
  })
}
