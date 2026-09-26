'use client'

import { useQuery } from '@tanstack/react-query'
import { useOptimisticListMutation } from '@/lib/optimistic'
import { attendanceEvents } from '../events'
import { attendanceKeys } from '../query-keys'
import { deleteBillingStatement, listBillingStatements, saveBillingStatement } from '../rpc'
import type { BillingStatementRow, SavedStatementValues } from '../schema'
import { statementTotals } from '../utils/billing-statement'

export function useBillingStatements(enabled = true) {
  return useQuery({
    queryKey: attendanceKeys.statementList(),
    queryFn: listBillingStatements,
    enabled,
    staleTime: 60 * 1000,
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
