'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure, announceSuccess } from '@/lib/announce'
import { contractEvents } from './events'
import { contractKeys } from './query-keys'
import {
  createCatalogItem,
  createContract,
  getContract,
  getContractTemplate,
  listCatalog,
  listContracts,
  setContractStatus,
  updateContract,
  updateContractTemplate,
} from './rpc'
import type {
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

export function useCatalog() {
  return useQuery({
    queryKey: contractKeys.catalog(),
    queryFn: listCatalog,
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: contractKeys.lists() }),
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: contractKeys.lists() }),
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: contractKeys.catalog() }),
  })
}
