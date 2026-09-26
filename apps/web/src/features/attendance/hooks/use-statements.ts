'use client'

import { useQuery } from '@tanstack/react-query'
import { useOptimisticListMutation } from '@/lib/optimistic'
import { attendanceEvents } from '../events'
import { attendanceKeys } from '../query-keys'
import {
  deleteBillingStatement,
  getStatementDefaults,
  listBillingStatements,
  listPayTerms,
  saveBillingStatement,
  setPayTerms,
} from '../rpc'
import type { BillingStatementRow, PayTermsRow, SavedStatementValues } from '../schema'
import { statementTotals } from '../utils/billing-statement'

export function useBillingStatements(enabled = true) {
  return useQuery({
    queryKey: attendanceKeys.statementList(),
    queryFn: listBillingStatements,
    enabled,
    staleTime: 60 * 1000,
  })
}

/** Who is billing and how they are paid; read-only on the form, re-checked by the server. */
export function useStatementDefaults() {
  return useQuery({
    queryKey: attendanceKeys.statementDefaults(),
    queryFn: getStatementDefaults,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePayTerms() {
  return useQuery({ queryKey: attendanceKeys.payTerms(), queryFn: listPayTerms })
}

export function useSetPayTerms() {
  return useOptimisticListMutation<PayTermsRow, PayTermsRow>({
    queryKey: attendanceKeys.payTerms(),
    mutationFn: (values) => setPayTerms(values),
    apply: (rows, next) => [...rows.filter((row) => row.userId !== next.userId), next],
    successEvent: attendanceEvents.payTermsSet,
    failureEvent: attendanceEvents.payTermsSetFailed,
    alsoInvalidate: [attendanceKeys.statementDefaults()],
  })
}

export function useSaveStatement() {
  return useOptimisticListMutation<BillingStatementRow, SavedStatementValues>({
    queryKey: attendanceKeys.statementList(),
    mutationFn: async (values) => {
      await saveBillingStatement(values)
    },
    // The same invoice number replaces its statement in place, as the server does.
    apply: (rows, values) => {
      const existing = rows.find((row) => row.invoiceNumber === values.invoiceNumber)
      const next: BillingStatementRow = {
        ...values,
        id: existing?.id ?? `pending-${crypto.randomUUID()}`,
        userId: existing?.userId ?? '',
        totalCents: statementTotals(values).totalCents,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      }
      return existing ? rows.map((row) => (row.id === existing.id ? next : row)) : [next, ...rows]
    },
    successEvent: attendanceEvents.statementSaved,
    failureEvent: attendanceEvents.statementSaveFailed,
    alsoInvalidate: [attendanceKeys.statements()],
  })
}

export function useDeleteStatement() {
  return useOptimisticListMutation<BillingStatementRow, { statementId: string }>({
    queryKey: attendanceKeys.statementList(),
    mutationFn: async ({ statementId }) => {
      await deleteBillingStatement(statementId)
    },
    apply: (rows, { statementId }) => rows.filter((row) => row.id !== statementId),
    successEvent: attendanceEvents.statementDeleted,
    failureEvent: attendanceEvents.statementDeleteFailed,
    alsoInvalidate: [attendanceKeys.statements()],
  })
}
